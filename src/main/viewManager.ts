import { BrowserWindow, WebContentsView, session, InputEvent } from 'electron';
import { WebsiteSlide, SlideRuntimeStatus, SlideLoadStatus } from '../types';

export interface ViewManagerCallbacks {
  onStatusChange: (status: SlideRuntimeStatus) => void;
  onUserInteraction: () => void;
  onPopupOpen: (url: string, profile: string) => void;
  onPopupClose: () => void;
  onHudVisibilityChange: (visible: boolean) => void;
  onShortcut: (action: 'toggle-fullscreen' | 'escape' | 'toggle-play' | 'next' | 'prev' | 'reload' | 'settings') => void;
}

const MAX_AUTO_RETRIES = 3;

export class ViewManager {
  private window: BrowserWindow;
  private uiView: WebContentsView;
  private callbacks: ViewManagerCallbacks;

  private views: Map<string, WebContentsView> = new Map();
  private slideConfigs: Map<string, WebsiteSlide> = new Map();
  private slideStatuses: Map<string, SlideLoadStatus> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  private activeSlideId: string | null = null;
  private popupView: WebContentsView | null = null;
  private isMonitoringActive = false;

  private isHudVisible = true;
  private isHudHovered = false;
  private isSlideMenuOpen = false;
  private hudHideTimer: NodeJS.Timeout | null = null;
  private lastInteractionTime = 0;

  constructor(window: BrowserWindow, uiView: WebContentsView, callbacks: ViewManagerCallbacks) {
    this.window = window;
    this.uiView = uiView;
    this.callbacks = callbacks;

    this.uiView.setBackgroundColor('#00000000');
    this.window.contentView.addChildView(this.uiView);

    this.attachShortcuts(this.uiView.webContents, true);

    this.window.on('resize', () => {
      this.updateAllBounds();
    });

    this.updateAllBounds();
  }

  syncSlides(slides: WebsiteSlide[]): void {
    const validIds = new Set(slides.map((s) => s.id));

    // Remove deleted slides
    for (const [id] of this.views) {
      if (!validIds.has(id)) {
        this.clearSlideView(id);
      }
    }

    // Check if existing views had URL, session_profile, or keep_alive changed
    for (const slide of slides) {
      const prevConfig = this.slideConfigs.get(slide.id);
      if (prevConfig) {
        const urlChanged = prevConfig.url !== slide.url;
        const profileChanged = prevConfig.session_profile !== slide.session_profile;
        if (urlChanged || profileChanged) {
          this.clearSlideView(slide.id);
        } else if (prevConfig.keep_alive !== slide.keep_alive) {
          const existingView = this.views.get(slide.id);
          if (existingView) {
            existingView.webContents.setBackgroundThrottling(!slide.keep_alive);
          }
        }
      }
      this.slideConfigs.set(slide.id, slide);
    }
  }

  showSlide(slide: WebsiteSlide): void {
    this.slideConfigs.set(slide.id, slide);
    if (!this.isMonitoringActive) return;

    if (this.activeSlideId && this.activeSlideId !== slide.id) {
      const prevView = this.views.get(this.activeSlideId);
      const prevConfig = this.slideConfigs.get(this.activeSlideId);
      if (prevView) {
        this.window.contentView.removeChildView(prevView);
        if (prevConfig && !prevConfig.keep_alive) {
          prevView.webContents.setBackgroundThrottling(true);
        }
      }
    }

    let view = this.views.get(slide.id);
    if (!view) {
      view = this.createSlideView(slide);
      this.views.set(slide.id, view);
    } else {
      view.webContents.setBackgroundThrottling(!slide.keep_alive);
      // If previous attempt failed, trigger a fresh reload when revisiting this slide
      const currentStatus = this.slideStatuses.get(slide.id);
      if (currentStatus === 'error' || currentStatus === 'crashed') {
        this.retryCounts.set(slide.id, 0);
        view.webContents.loadURL(slide.url);
      }
    }

    this.activeSlideId = slide.id;
    this.window.contentView.addChildView(view);
    this.ensureTopLayers();
    this.wakeHud();
    this.updateAllBounds();
  }

  reloadActiveSlide(): void {
    if (!this.activeSlideId) return;
    const view = this.views.get(this.activeSlideId);
    const slide = this.slideConfigs.get(this.activeSlideId);
    if (view && slide) {
      this.clearRetryTimer(this.activeSlideId);
      this.retryCounts.set(this.activeSlideId, 0);
      this.setSlideStatus(this.activeSlideId, {
        slide_id: this.activeSlideId,
        status: 'loading',
        retry_count: 0
      });
      view.webContents.loadURL(slide.url);
    }
  }

  setMonitoringMode(active: boolean): void {
    this.isMonitoringActive = active;

    if (!active) {
      if (this.activeSlideId) {
        const currentView = this.views.get(this.activeSlideId);
        if (currentView) {
          this.window.contentView.removeChildView(currentView);
        }
      }
      this.closePopup();
      this.clearHudTimer();
      this.isSlideMenuOpen = false;
    } else {
      if (this.activeSlideId) {
        const currentView = this.views.get(this.activeSlideId);
        if (currentView) {
          this.window.contentView.addChildView(currentView);
        }
      }
      this.wakeHud();
    }

    this.ensureTopLayers();
    this.updateAllBounds();
  }

  openPopup(url: string, explicitProfile?: string): void {
    if (this.popupView) {
      this.closePopup();
    }

    const activeSlide = this.activeSlideId ? this.slideConfigs.get(this.activeSlideId) : undefined;
    const profile = explicitProfile || activeSlide?.session_profile || 'default';
    const partition = `persist:${profile}`;
    const customSession = session.fromPartition(partition);

    this.popupView = new WebContentsView({
      webPreferences: {
        session: customSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.attachInputMonitor(this.popupView.webContents);
    this.attachShortcuts(this.popupView.webContents, false);

    this.popupView.webContents.setWindowOpenHandler((details) => {
      if (this.isAllowedProtocol(details.url)) {
        this.popupView?.webContents.loadURL(details.url);
      }
      return { action: 'deny' };
    });

    this.window.contentView.addChildView(this.popupView);
    this.ensureTopLayers();
    this.updateAllBounds();

    if (this.isAllowedProtocol(url)) {
      this.popupView.webContents.loadURL(url);
    }

    this.callbacks.onPopupOpen(url, profile);
  }

  closePopup(): void {
    if (this.popupView) {
      this.window.contentView.removeChildView(this.popupView);
      this.popupView.webContents.close();
      this.popupView = null;
      this.callbacks.onPopupClose();
      this.ensureTopLayers();
      this.updateAllBounds();
    }
  }

  isPopupOpen(): boolean {
    return this.popupView !== null;
  }

  setHudHovered(hovered: boolean): void {
    this.isHudHovered = hovered;
    if (hovered) {
      this.clearHudTimer();
      if (!this.isHudVisible) {
        this.isHudVisible = true;
        this.callbacks.onHudVisibilityChange(true);
        this.updateAllBounds();
      }
    } else if (!this.isSlideMenuOpen) {
      this.scheduleHudHide();
    }
  }

  setSlideMenuOpen(open: boolean): void {
    this.isSlideMenuOpen = open;
    if (open) {
      this.clearHudTimer();
      this.isHudVisible = true;
      this.callbacks.onHudVisibilityChange(true);
    } else if (!this.isHudHovered) {
      this.scheduleHudHide();
    }
    this.updateAllBounds();
  }

  wakeHud(): void {
    if (!this.isMonitoringActive) return;

    if (!this.isHudVisible) {
      this.isHudVisible = true;
      this.callbacks.onHudVisibilityChange(true);
      this.updateAllBounds();
    }

    if (!this.isHudHovered && !this.isSlideMenuOpen) {
      this.scheduleHudHide();
    }
  }

  clearSlideView(slideId: string): void {
    this.clearRetryTimer(slideId);
    const view = this.views.get(slideId);
    if (view) {
      if (this.activeSlideId === slideId) {
        this.window.contentView.removeChildView(view);
        this.activeSlideId = null;
      }
      view.webContents.close();
      this.views.delete(slideId);
    }
    this.slideConfigs.delete(slideId);
    this.slideStatuses.delete(slideId);
    this.retryCounts.delete(slideId);
  }

  async clearSessionProfile(profileName: string): Promise<void> {
    const cleanProfile = profileName.trim() || 'default';
    const partition = `persist:${cleanProfile}`;
    const sess = session.fromPartition(partition);
    await sess.clearStorageData();
    await sess.clearCache();

    // Reload any active views using this profile so login state refreshes immediately
    for (const [slideId, config] of this.slideConfigs.entries()) {
      if ((config.session_profile || 'default') === cleanProfile) {
        const view = this.views.get(slideId);
        if (view) {
          view.webContents.loadURL(config.url);
        }
      }
    }
  }

  destroy(): void {
    this.closePopup();
    this.clearHudTimer();
    for (const [id] of this.retryTimers) {
      this.clearRetryTimer(id);
    }
    for (const [, view] of this.views) {
      view.webContents.close();
    }
    this.views.clear();
    this.slideConfigs.clear();
    this.slideStatuses.clear();
    this.retryCounts.clear();
    this.activeSlideId = null;
  }

  private createSlideView(slide: WebsiteSlide): WebContentsView {
    const partition = `persist:${slide.session_profile || 'default'}`;
    const customSession = session.fromPartition(partition);

    const view = new WebContentsView({
      webPreferences: {
        session: customSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: !slide.keep_alive
      }
    });

    view.webContents.on('did-start-loading', () => {
      this.setSlideStatus(slide.id, {
        slide_id: slide.id,
        status: 'loading',
        retry_count: this.retryCounts.get(slide.id) || 0
      });
    });

    view.webContents.on('did-finish-load', () => {
      // Only mark ready if not currently in error state from did-fail-load
      if (this.slideStatuses.get(slide.id) !== 'error') {
        this.retryCounts.set(slide.id, 0);
        this.setSlideStatus(slide.id, {
          slide_id: slide.id,
          status: 'ready',
          retry_count: 0,
          last_loaded_at: Date.now()
        });
      }
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
      // Ignore subframe errors or cancelled navigations (-3 is ERR_ABORTED)
      if (!isMainFrame || errorCode === -3) return;

      const currentRetries = this.retryCounts.get(slide.id) || 0;
      this.setSlideStatus(slide.id, {
        slide_id: slide.id,
        status: 'error',
        retry_count: currentRetries,
        error_message: `${errorDescription} (Kode: ${errorCode})`
      });

      this.scheduleAutoRetry(slide.id);
    });

    view.webContents.on('render-process-gone', (_event, details) => {
      const currentRetries = this.retryCounts.get(slide.id) || 0;
      this.setSlideStatus(slide.id, {
        slide_id: slide.id,
        status: 'crashed',
        retry_count: currentRetries,
        error_message: `Proses renderer berhenti: ${details.reason}`
      });

      this.scheduleAutoRetry(slide.id);
    });

    // Block navigation to unsafe protocols
    view.webContents.on('will-navigate', (event, url) => {
      if (!this.isAllowedProtocol(url)) {
        event.preventDefault();
      }
    });

    this.attachInputMonitor(view.webContents);
    this.attachShortcuts(view.webContents, false);

    view.webContents.setWindowOpenHandler((details) => {
      if (this.isAllowedProtocol(details.url)) {
        this.openPopup(details.url, slide.session_profile);
      }
      return { action: 'deny' };
    });

    if (this.isAllowedProtocol(slide.url)) {
      view.webContents.loadURL(slide.url);
    }

    return view;
  }

  private setSlideStatus(slideId: string, status: SlideRuntimeStatus): void {
    this.slideStatuses.set(slideId, status.status);
    this.callbacks.onStatusChange(status);
    if (this.activeSlideId === slideId) {
      this.updateAllBounds();
    }
  }

  private scheduleAutoRetry(slideId: string): void {
    this.clearRetryTimer(slideId);
    const currentRetries = this.retryCounts.get(slideId) || 0;
    if (currentRetries >= MAX_AUTO_RETRIES) return;

    const nextRetry = currentRetries + 1;
    this.retryCounts.set(slideId, nextRetry);

    // Bounded exponential backoff: 5s, 10s, 20s
    const delayMs = 5000 * Math.pow(2, currentRetries);
    const timer = setTimeout(() => {
      this.retryTimers.delete(slideId);
      const view = this.views.get(slideId);
      const slide = this.slideConfigs.get(slideId);
      if (view && slide) {
        this.setSlideStatus(slideId, {
          slide_id: slideId,
          status: 'loading',
          retry_count: nextRetry
        });
        view.webContents.loadURL(slide.url);
      }
    }, delayMs);

    this.retryTimers.set(slideId, timer);
  }

  private clearRetryTimer(slideId: string): void {
    const timer = this.retryTimers.get(slideId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(slideId);
    }
  }

  private attachInputMonitor(wc: Electron.WebContents): void {
    wc.on('input-event', (_event, input: InputEvent) => {
      if (
        input.type === 'mouseMove' ||
        input.type === 'mouseDown' ||
        input.type === 'mouseWheel' ||
        input.type === 'keyDown'
      ) {
        const now = Date.now();
        if (input.type === 'mouseMove' && now - this.lastInteractionTime < 250) {
          return;
        }
        this.lastInteractionTime = now;
        this.wakeHud();
        this.callbacks.onUserInteraction();
      }
    });
  }

  private attachShortcuts(wc: Electron.WebContents, isUiLayer: boolean): void {
    wc.on('before-input-event', (_event, input) => {
      if (input.type !== 'keyDown') return;

      if (input.key === 'F11') {
        this.callbacks.onShortcut('toggle-fullscreen');
        return;
      }

      if (input.key === 'Escape') {
        this.callbacks.onShortcut('escape');
        return;
      }

      if (input.key === 'F5' || (input.key.toLowerCase() === 'r' && input.control)) {
        this.callbacks.onShortcut('reload');
        return;
      }

      // When focused inside an external website, require Alt/Ctrl for single-key shortcuts
      // so typing into login forms (e.g. username/password) is never interrupted
      if (isUiLayer) {
        if (input.key === ' ' && !input.control && !input.alt) {
          this.callbacks.onShortcut('toggle-play');
          return;
        }
        if (input.key === 'ArrowRight') {
          this.callbacks.onShortcut('next');
          return;
        }
        if (input.key === 'ArrowLeft') {
          this.callbacks.onShortcut('prev');
          return;
        }
        if (input.key.toLowerCase() === 's' && !input.control && !input.alt) {
          this.callbacks.onShortcut('settings');
          return;
        }
      } else {
        if (input.key === 'ArrowRight' && input.alt) {
          this.callbacks.onShortcut('next');
          return;
        }
        if (input.key === 'ArrowLeft' && input.alt) {
          this.callbacks.onShortcut('prev');
          return;
        }
        if (input.key.toLowerCase() === 's' && input.alt) {
          this.callbacks.onShortcut('settings');
          return;
        }
      }
    });
  }

  private scheduleHudHide(): void {
    this.clearHudTimer();
    this.hudHideTimer = setTimeout(() => {
      if (this.isHudHovered || this.isSlideMenuOpen) return;
      this.isHudVisible = false;
      this.callbacks.onHudVisibilityChange(false);
      this.updateAllBounds();
    }, 3500);
  }

  private clearHudTimer(): void {
    if (this.hudHideTimer) {
      clearTimeout(this.hudHideTimer);
      this.hudHideTimer = null;
    }
  }

  private ensureTopLayers(): void {
    if (this.popupView) {
      this.window.contentView.addChildView(this.popupView);
    }
    this.window.contentView.addChildView(this.uiView);
  }

  private updateAllBounds(): void {
    const [width, height] = this.window.getContentSize();
    if (width <= 0 || height <= 0) return;

    const isFullscreen = this.window.isFullScreen();
    const titleBarHeight = isFullscreen ? 0 : 42;

    // 1. Active Slide View
    if (this.activeSlideId && this.isMonitoringActive) {
      const slideView = this.views.get(this.activeSlideId);
      if (slideView) {
        slideView.setBounds({
          x: 0,
          y: titleBarHeight,
          width,
          height: Math.max(0, height - titleBarHeight)
        });
      }
    }

    // 2. Popup View fills below the 42px title bar + 56px popup header
    if (this.popupView) {
      const topOffset = titleBarHeight + 56;
      this.popupView.setBounds({
        x: 0,
        y: topOffset,
        width,
        height: Math.max(0, height - topOffset)
      });
      this.uiView.setBounds({ x: 0, y: 0, width, height: topOffset });
      return;
    }

    // 3. Settings Mode: UI view covers full window
    if (!this.isMonitoringActive) {
      this.uiView.setBounds({ x: 0, y: 0, width, height });
      return;
    }

    // 4. Error or Crashed Slide in Monitoring Mode: UI view covers full window for Fallback Card + HUD
    const activeStatus = this.activeSlideId ? this.slideStatuses.get(this.activeSlideId) : 'idle';
    if (activeStatus === 'error' || activeStatus === 'crashed') {
      this.uiView.setBounds({ x: 0, y: 0, width, height });
      return;
    }

    // 5. Normal Monitoring Mode: UI view bounds wrap the Floating HUD at bottom center
    if (this.isHudVisible) {
      const hudWidth = Math.min(width, 860);
      const hudHeight = this.isSlideMenuOpen ? Math.min(height, 420) : 92;
      this.uiView.setBounds({
        x: Math.round((width - hudWidth) / 2),
        y: Math.max(0, height - hudHeight),
        width: hudWidth,
        height: hudHeight
      });
    } else {
      // Thin 6px wake strip at bottom center when auto-hidden
      const stripWidth = Math.min(width, 420);
      this.uiView.setBounds({
        x: Math.round((width - stripWidth) / 2),
        y: Math.max(0, height - 6),
        width: stripWidth,
        height: 6
      });
    }
  }

  private isAllowedProtocol(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
