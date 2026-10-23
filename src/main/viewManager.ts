import { BrowserWindow, WebContentsView, session, Session, InputEvent, webContents } from 'electron';
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

  private slideAnimationEnabled = true;
  private activeAnimationCancel: (() => void) | null = null;
  private isAnimating = false;

  private isHudVisible = true;
  private isHudHovered = false;
  private isSlideMenuOpen = false;
  private hudHideTimer: NodeJS.Timeout | null = null;
  private lastInteractionTime = 0;

  private cursorIdleTimer: NodeJS.Timeout | null = null;
  private isCursorHidden = false;
  private cursorHideKeys: Map<number, string> = new Map();

  constructor(window: BrowserWindow, uiView: WebContentsView, callbacks: ViewManagerCallbacks) {
    this.window = window;
    this.uiView = uiView;
    this.callbacks = callbacks;

    // Allow self-signed SSL certificates on default session
    session.defaultSession.setCertificateVerifyProc((_request, callback) => {
      callback(0);
    });

    this.uiView.setBackgroundColor('#00000000');
    this.window.contentView.addChildView(this.uiView);

    this.attachShortcuts(this.uiView.webContents, true);
    this.attachInputMonitor(this.uiView.webContents);

    this.window.on('resize', () => {
      this.updateAllBounds();
    });

    this.window.on('enter-full-screen', () => {
      this.resetCursorIdleTimer();
    });

    this.window.on('leave-full-screen', () => {
      this.showCursor();
    });

    this.updateAllBounds();
  }

  setSlideAnimationEnabled(enabled: boolean): void {
    this.slideAnimationEnabled = enabled;
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

  showSlide(slide: WebsiteSlide, direction: 'next' | 'prev' | 'none' = 'none'): void {
    this.slideConfigs.set(slide.id, slide);
    if (!this.isMonitoringActive) return;

    const prevSlideId = this.activeSlideId;
    const isDifferentSlide = prevSlideId !== null && prevSlideId !== slide.id;

    if (!isDifferentSlide && this.activeSlideId === slide.id) {
      const existingView = this.views.get(slide.id);
      if (existingView) {
        const currentStatus = this.slideStatuses.get(slide.id);
        if (currentStatus === 'error' || currentStatus === 'crashed') {
          this.retryCounts.set(slide.id, 0);
          existingView.webContents.loadURL(slide.url);
        }
      }
      return;
    }

    const prevView = prevSlideId ? this.views.get(prevSlideId) : null;
    const prevConfig = prevSlideId ? this.slideConfigs.get(prevSlideId) : undefined;

    let nextView = this.views.get(slide.id);
    if (!nextView) {
      nextView = this.createSlideView(slide);
      this.views.set(slide.id, nextView);
    } else {
      nextView.webContents.setBackgroundThrottling(false);
      const currentStatus = this.slideStatuses.get(slide.id);
      if (currentStatus === 'error' || currentStatus === 'crashed') {
        this.retryCounts.set(slide.id, 0);
        nextView.webContents.loadURL(slide.url);
      }
    }

    const canAnimate =
      this.slideAnimationEnabled &&
      (direction === 'next' || direction === 'prev') &&
      prevView !== null &&
      prevView !== nextView;

    if (canAnimate && prevView) {
      this.activeSlideId = slide.id;
      if (this.isCursorHidden) {
        this.applyCursorHideToWebContents(nextView.webContents);
      }
      this.animateSlideTransition(prevView, nextView, direction, prevConfig);
    } else {
      if (this.activeAnimationCancel) {
        this.activeAnimationCancel();
        this.activeAnimationCancel = null;
      }

      if (prevView && prevView !== nextView) {
        const prevKey = this.cursorHideKeys.get(prevView.webContents.id);
        if (prevKey) {
          prevView.webContents.removeInsertedCSS(prevKey).catch(() => {});
          this.cursorHideKeys.delete(prevView.webContents.id);
        }
        try {
          this.window.contentView.removeChildView(prevView);
        } catch {}
        if (prevConfig && !prevConfig.keep_alive) {
          prevView.webContents.setBackgroundThrottling(true);
        }
      }

      this.activeSlideId = slide.id;
      if (this.isCursorHidden) {
        this.applyCursorHideToWebContents(nextView.webContents);
      }
      const [width, height] = this.window.getContentSize();
      nextView.setBounds({ x: 0, y: 0, width, height });
      this.window.contentView.addChildView(nextView);
      this.ensureTopLayers();
      this.updateAllBounds();
    }
  }

  private animateSlideTransition(
    prevView: WebContentsView,
    nextView: WebContentsView,
    direction: 'next' | 'prev',
    prevConfig?: WebsiteSlide | null
  ): void {
    if (this.activeAnimationCancel) {
      this.activeAnimationCancel();
      this.activeAnimationCancel = null;
    }

    if (!this.window || this.window.isDestroyed()) return;

    prevView.webContents.setBackgroundThrottling(false);
    nextView.webContents.setBackgroundThrottling(false);

    const [initialW, initialH] = this.window.getContentSize();

    if (direction === 'next') {
      prevView.setBounds({ x: 0, y: 0, width: initialW, height: initialH });
      nextView.setBounds({ x: initialW, y: 0, width: initialW, height: initialH });
    } else {
      prevView.setBounds({ x: 0, y: 0, width: initialW, height: initialH });
      nextView.setBounds({ x: -initialW, y: 0, width: initialW, height: initialH });
    }

    this.window.contentView.addChildView(nextView);
    this.ensureTopLayers();

    this.isAnimating = true;
    const duration = 350;
    const startTime = performance.now();
    let timer: NodeJS.Timeout | null = null;
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      this.activeAnimationCancel = null;
      this.isAnimating = false;

      if (this.window && !this.window.isDestroyed()) {
        if (prevView && prevView !== nextView) {
          const prevKey = this.cursorHideKeys.get(prevView.webContents.id);
          if (prevKey) {
            prevView.webContents.removeInsertedCSS(prevKey).catch(() => {});
            this.cursorHideKeys.delete(prevView.webContents.id);
          }
        }
        try {
          this.window.contentView.removeChildView(prevView);
        } catch {}
        if (prevConfig && !prevConfig.keep_alive) {
          prevView.webContents.setBackgroundThrottling(true);
        }

        const [finalW, finalH] = this.window.getContentSize();
        nextView.setBounds({ x: 0, y: 0, width: finalW, height: finalH });
        this.ensureTopLayers();
        this.updateAllBounds();
      }
    };

    this.activeAnimationCancel = finish;

    const step = () => {
      if (isFinished || !this.window || this.window.isDestroyed()) {
        finish();
        return;
      }

      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic curve for smooth natural deceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const [w, h] = this.window.getContentSize();
      const offset = Math.round(w * ease);

      if (direction === 'next') {
        prevView.setBounds({ x: -offset, y: 0, width: w, height: h });
        nextView.setBounds({ x: w - offset, y: 0, width: w, height: h });
      } else {
        prevView.setBounds({ x: offset, y: 0, width: w, height: h });
        nextView.setBounds({ x: -w + offset, y: 0, width: w, height: h });
      }

      if (progress < 1) {
        timer = setTimeout(step, 8);
      } else {
        finish();
      }
    };

    step();
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
      this.showCursor();
      if (this.activeAnimationCancel) {
        this.activeAnimationCancel();
        this.activeAnimationCancel = null;
      }
      this.closePopup();
      this.clearHudTimer();
      this.isSlideMenuOpen = false;

      // Immediately expand uiView to full window BEFORE removing slide view to prevent any background flash or squish
      const [w, h] = this.window.getContentSize();
      this.uiView.setBounds({ x: 0, y: 0, width: w, height: h });
      this.ensureTopLayers();

      if (this.activeSlideId) {
        const currentView = this.views.get(this.activeSlideId);
        if (currentView) {
          try {
            this.window.contentView.removeChildView(currentView);
          } catch {}
          const config = this.slideConfigs.get(this.activeSlideId);
          if (config && !config.keep_alive) {
            currentView.webContents.setBackgroundThrottling(true);
          }
        }
      }
    } else {
      this.resetCursorIdleTimer();
      if (this.activeSlideId) {
        const currentView = this.views.get(this.activeSlideId);
        if (currentView) {
          this.window.contentView.addChildView(currentView);
        }
      }
      this.wakeHud();
      this.ensureTopLayers();
      this.updateAllBounds();
    }
  }

  openPopup(url: string, explicitProfile?: string): void {
    this.showCursor();
    if (this.popupView) {
      this.closePopup();
    }

    const activeSlide = this.activeSlideId ? this.slideConfigs.get(this.activeSlideId) : undefined;
    const profile = explicitProfile || activeSlide?.session_profile || 'default';
    const customSession = this.getSession(profile);

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

    this.popupView.webContents.on('did-finish-load', () => {
      try {
        this.popupView?.webContents.setZoomLevel(0);
        this.popupView?.webContents.setZoomFactor(1.0);
      } catch {}
    });

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
      this.resetCursorIdleTimer();
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
    if (this.activeSlideId === slideId && this.activeAnimationCancel) {
      this.activeAnimationCancel();
      this.activeAnimationCancel = null;
    }
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
    const sess = this.getSession(cleanProfile);
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
    this.showCursor();
    if (this.activeAnimationCancel) {
      this.activeAnimationCancel();
      this.activeAnimationCancel = null;
    }
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

  private getSession(profileName: string): Session {
    const cleanProfile = profileName.trim() || 'default';
    const partition = `persist:${cleanProfile}`;
    const customSession = session.fromPartition(partition);
    customSession.setCertificateVerifyProc((_request, callback) => {
      // 0 = certificate verification succeeded / trust certificate (bypasses self-signed SSL)
      callback(0);
    });
    return customSession;
  }

  private createSlideView(slide: WebsiteSlide): WebContentsView {
    const customSession = this.getSession(slide.session_profile || 'default');

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
      try {
        view.webContents.setZoomLevel(0);
        view.webContents.setZoomFactor(1.0);
      } catch {}

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
        if (input.type === 'mouseMove') {
          this.resetCursorIdleTimer();
        } else {
          this.showCursor();
          this.resetCursorIdleTimer();
        }

        const now = Date.now();
        if (input.type === 'mouseMove' && now - this.lastInteractionTime < 250) {
          return;
        }
        this.lastInteractionTime = now;
        this.callbacks.onUserInteraction();
      }
    });
  }

  private resetCursorIdleTimer(): void {
    this.showCursor();

    if (this.cursorIdleTimer) {
      clearTimeout(this.cursorIdleTimer);
      this.cursorIdleTimer = null;
    }

    if (this.isMonitoringActive && this.window && !this.window.isDestroyed() && this.window.isFullScreen()) {
      this.cursorIdleTimer = setTimeout(() => {
        this.hideCursor();
      }, 2000);
    }
  }

  private applyCursorHideToWebContents(wc: Electron.WebContents): void {
    if (!wc || wc.isDestroyed()) return;
    const css = '*, *:hover, *:active { cursor: none !important; }';
    wc.insertCSS(css)
      .then((key) => {
        if (this.isCursorHidden && !wc.isDestroyed()) {
          this.cursorHideKeys.set(wc.id, key);
        } else if (!wc.isDestroyed()) {
          wc.removeInsertedCSS(key).catch(() => {});
        }
      })
      .catch(() => {});
  }

  private hideCursor(): void {
    if (this.isCursorHidden) return;
    if (!this.isMonitoringActive || !this.window || this.window.isDestroyed() || !this.window.isFullScreen()) return;

    this.isCursorHidden = true;

    // Apply to current active slide view
    if (this.activeSlideId) {
      const activeView = this.views.get(this.activeSlideId);
      if (activeView) {
        this.applyCursorHideToWebContents(activeView.webContents);
      }
    }

    // Apply to uiView
    if (this.uiView) {
      this.applyCursorHideToWebContents(this.uiView.webContents);
    }
  }

  public showCursor(): void {
    if (this.cursorIdleTimer) {
      clearTimeout(this.cursorIdleTimer);
      this.cursorIdleTimer = null;
    }

    if (!this.isCursorHidden) return;
    this.isCursorHidden = false;

    for (const [wcId, key] of this.cursorHideKeys.entries()) {
      try {
        const wc = webContents.fromId(wcId);
        if (wc && !wc.isDestroyed()) {
          wc.removeInsertedCSS(key).catch(() => {});
        }
      } catch {}
    }
    this.cursorHideKeys.clear();
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

      if ((input.key === '0' || input.key === 'NumPad0') && input.control) {
        try {
          wc.setZoomLevel(0);
          wc.setZoomFactor(1.0);
        } catch {}
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
      // Wait for 300ms CSS slide-up transition before collapsing WebContentsView bounds
      setTimeout(() => {
        if (!this.isHudVisible && !this.isHudHovered) {
          this.updateAllBounds();
        }
      }, 320);
    }, 2500);
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

    // 1. Active Slide View always fills the window in monitoring mode (when not animating)
    if (this.activeSlideId && this.isMonitoringActive && !this.isAnimating) {
      const slideView = this.views.get(this.activeSlideId);
      if (slideView) {
        slideView.setBounds({ x: 0, y: 0, width, height });
      }
    }

    // 2. Popup View fills below the 56px top bar
    if (this.popupView) {
      const topOffset = 56;
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

    // 5. Normal Monitoring Mode: UI view bounds wrap the Floating HUD at top center
    if (this.isHudVisible) {
      const hudWidth = Math.min(width, 560);
      const hudHeight = this.isSlideMenuOpen ? Math.min(height, 460) : 60;
      this.uiView.setBounds({
        x: Math.round((width - hudWidth) / 2),
        y: 0,
        width: hudWidth,
        height: hudHeight
      });
    } else {
      // Thin 8px wake strip at top center when auto-hidden
      const stripWidth = Math.min(width, 420);
      this.uiView.setBounds({
        x: Math.round((width - stripWidth) / 2),
        y: 0,
        width: stripWidth,
        height: 8
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
