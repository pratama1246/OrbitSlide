import { BrowserWindow, session, Session, InputEvent, webContents } from 'electron';
import { WebsiteSlide, SlideRuntimeStatus, SlideLoadStatus } from '../types';
import { ViewHost, UnifiedView } from './viewHost';
import { isStandbySlide, writeStandbyHtmlFile } from './standbyPage';

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
  private viewHost: ViewHost;
  private uiView: UnifiedView;
  private callbacks: ViewManagerCallbacks;

  private views: Map<string, UnifiedView> = new Map();
  private slideConfigs: Map<string, WebsiteSlide> = new Map();
  private slideStatuses: Map<string, SlideLoadStatus> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  private activeSlideId: string | null = null;
  private popupView: UnifiedView | null = null;
  private isMonitoringActive = false;

  private slideAnimationEnabled = true;
  private language: 'id' | 'en' = 'id';
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
  private prewarmTimer: NodeJS.Timeout | null = null;
  private lastReloadTimes: Map<string, number> = new Map();

  constructor(window: BrowserWindow, viewHost: ViewHost, uiView: UnifiedView, callbacks: ViewManagerCallbacks) {
    this.window = window;
    this.viewHost = viewHost;
    this.uiView = uiView;
    this.callbacks = callbacks;

    this.uiView.setBackgroundColor('#00000000');
    this.viewHost.addView(this.uiView);

    this.attachShortcuts(this.uiView.webContents, true);
    this.attachInputMonitor(this.uiView.webContents);

    this.window.on('resize', () => {
      if (!this.isAnimating && this.window && !this.window.isDestroyed()) {
        const [w, h] = this.window.getContentSize();
        for (const [, view] of this.views) {
          view.setBounds({ x: 0, y: 0, width: w, height: h });
        }
      }
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

  setLanguage(lang: 'id' | 'en'): void {
    const prev = this.language;
    this.language = lang;
    if (prev !== lang) {
      this.refreshStandbySlide();
    }
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
            existingView.webContents.setBackgroundThrottling(this.activeSlideId !== slide.id);
          }
        }
      }
      this.slideConfigs.set(slide.id, slide);
    }
  }

  showSlide(slide: WebsiteSlide, direction: 'next' | 'prev' | 'none' = 'none'): void {
    this.slideConfigs.set(slide.id, slide);
    if (!this.isMonitoringActive) return;

    const now = Date.now();
    const lastReload = this.lastReloadTimes.get(slide.id) || 0;
    let shouldReload = false;

    // Check if this slide needs to be refreshed
    if (slide.id !== 'system-standby') {
      if (slide.reload_interval === -1) {
        if (this.views.has(slide.id) && lastReload > 0) {
          shouldReload = true;
        }
      } else if (slide.reload_interval && slide.reload_interval > 0) {
        const intervalMs = slide.reload_interval * 60 * 1000;
        if (this.views.has(slide.id) && lastReload > 0 && now - lastReload >= intervalMs) {
          shouldReload = true;
        }
      }
    }

    if (this.activeSlideId === slide.id && !this.isAnimating) {
      const existingView = this.views.get(slide.id);
      if (existingView) {
        existingView.webContents.setBackgroundThrottling(false);
        const currentStatus = this.slideStatuses.get(slide.id);
        if (currentStatus === 'error' || currentStatus === 'crashed' || shouldReload) {
          this.retryCounts.set(slide.id, 0);
          this.lastReloadTimes.set(slide.id, now);
          this.loadSlideUrl(existingView.webContents, slide);
        }
      }
      return;
    }

    // Settle any in-progress transition before resolving prevView and starting the next transition
    if (this.activeAnimationCancel) {
      this.activeAnimationCancel();
      this.activeAnimationCancel = null;
    }

    const prevSlideId = this.activeSlideId;
    const prevView = prevSlideId ? this.views.get(prevSlideId) : null;

    let nextView = this.views.get(slide.id);
    if (!nextView) {
      nextView = this.createSlideView(slide);
      this.views.set(slide.id, nextView);
      this.lastReloadTimes.set(slide.id, now);
    } else {
      nextView.webContents.setBackgroundThrottling(false);
      const currentStatus = this.slideStatuses.get(slide.id);
      if (currentStatus === 'error' || currentStatus === 'crashed' || shouldReload) {
        this.retryCounts.set(slide.id, 0);
        this.lastReloadTimes.set(slide.id, now);
        this.loadSlideUrl(nextView.webContents, slide);
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
      this.animateSlideTransition(prevView, nextView, direction);
    } else {
      if (prevView && prevView !== nextView) {
        const prevKey = this.cursorHideKeys.get(prevView.webContents.id);
        if (prevKey) {
          prevView.webContents.removeInsertedCSS(prevKey).catch(() => {});
          this.cursorHideKeys.delete(prevView.webContents.id);
        }
        try {
          this.viewHost.removeView(prevView);
          prevView.webContents.setBackgroundThrottling(true);
        } catch {}
      }

      this.activeSlideId = slide.id;
      if (this.isCursorHidden) {
        this.applyCursorHideToWebContents(nextView.webContents);
      }
      const [width, height] = this.window.getContentSize();
      nextView.setBounds({ x: 0, y: 0, width, height });
      this.viewHost.addView(nextView);
      this.ensureTopLayers();
      this.updateAllBounds();
    }

    this.schedulePrewarmSlides();
  }

  private getActiveSlidesList(): WebsiteSlide[] {
    const list: WebsiteSlide[] = [];
    for (const slide of this.slideConfigs.values()) {
      if (slide.is_active) list.push(slide);
    }
    return list.sort((a, b) => a.sort_order - b.sort_order);
  }

  private schedulePrewarmSlides(): void {
    if (this.prewarmTimer) {
      clearTimeout(this.prewarmTimer);
      this.prewarmTimer = null;
    }

    this.prewarmTimer = setTimeout(() => {
      this.prewarmTimer = null;
      if (!this.isMonitoringActive || !this.window || this.window.isDestroyed() || !this.activeSlideId) return;

      const activeList = this.getActiveSlidesList();
      if (activeList.length <= 1) return;

      const currentIndex = activeList.findIndex((s) => s.id === this.activeSlideId);
      if (currentIndex === -1) return;

      const nextSlide = activeList[(currentIndex + 1) % activeList.length];
      const prevSlide = activeList[(currentIndex - 1 + activeList.length) % activeList.length];
      const neededIds = new Set<string>([this.activeSlideId, nextSlide.id, prevSlide.id]);

      // 1. Prewarm immediate next slide if not already cached
      if (!this.views.has(nextSlide.id)) {
        const nextView = this.createSlideView(nextSlide);
        this.views.set(nextSlide.id, nextView);
        this.lastReloadTimes.set(nextSlide.id, Date.now());
      }

      // 2. Safe Cache Maintenance: Only remove views of deleted/inactive slides
      const activeIds = new Set(activeList.map((s) => s.id));
      for (const [id, view] of this.views.entries()) {
        if (!activeIds.has(id)) {
          try {
            this.viewHost.removeView(view);
            view.webContents.close();
          } catch {}
          this.views.delete(id);
          this.slideStatuses.delete(id);
          this.retryCounts.delete(id);
          this.lastReloadTimes.delete(id);
        }
      }

      // 3. High-capacity safeguard: if cached views exceed 15 slides, prune furthest inactive
      if (this.views.size > 15) {
        for (const [id, view] of this.views.entries()) {
          if (!neededIds.has(id) && id !== this.activeSlideId) {
            try {
              this.viewHost.removeView(view);
              view.webContents.close();
            } catch {}
            this.views.delete(id);
            this.slideStatuses.delete(id);
            this.retryCounts.delete(id);
            this.lastReloadTimes.delete(id);
            if (this.views.size <= 15) break;
          }
        }
      }
    }, 300);
  }

  private animateSlideTransition(
    prevView: UnifiedView,
    nextView: UnifiedView,
    direction: 'next' | 'prev'
  ): void {
    if (this.activeAnimationCancel) {
      this.activeAnimationCancel();
      this.activeAnimationCancel = null;
    }

    if (!this.window || this.window.isDestroyed()) return;

    prevView.webContents.setBackgroundThrottling(false);
    nextView.webContents.setBackgroundThrottling(false);

    const [initialW, initialH] = this.window.getContentSize();

    // Place nextView with 1px inside the viewport so Chromium's compositor immediately marks it visible and uploads its texture
    const initialNextX = direction === 'next' ? Math.max(0, initialW - 1) : -Math.max(0, initialW - 1);
    prevView.setBounds({ x: 0, y: 0, width: initialW, height: initialH });
    nextView.setBounds({ x: initialNextX, y: 0, width: initialW, height: initialH });

    this.viewHost.addView(nextView);
    this.ensureTopLayers();

    this.isAnimating = true;
    const duration = 360;
    const startTime = performance.now();
    let timer: NodeJS.Timeout | null = null;
    let isFinished = false;
    let lastOffset = -1;

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
          this.viewHost.removeView(prevView);
          prevView.webContents.setBackgroundThrottling(true);
        } catch {}

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
      // Cubic ease-out: immediate start on frame 1 with smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const [w, h] = this.window.getContentSize();
      const offset = Math.round(w * ease);

      if (offset !== lastOffset) {
        lastOffset = offset;
        if (direction === 'next') {
          prevView.setBounds({ x: -offset, y: 0, width: w, height: h });
          nextView.setBounds({ x: w - offset, y: 0, width: w, height: h });
        } else {
          prevView.setBounds({ x: offset, y: 0, width: w, height: h });
          nextView.setBounds({ x: -w + offset, y: 0, width: w, height: h });
        }
      }

      if (progress < 1) {
        timer = setTimeout(step, 8);
      } else {
        finish();
      }
    };

    timer = setTimeout(step, 8);
  }

  reloadActiveSlide(): void {
    if (!this.activeSlideId) return;
    const view = this.views.get(this.activeSlideId);
    const slide = this.slideConfigs.get(this.activeSlideId);
    if (view && slide) {
      this.clearRetryTimer(this.activeSlideId);
      this.retryCounts.set(this.activeSlideId, 0);
      this.lastReloadTimes.set(this.activeSlideId, Date.now());
      this.setSlideStatus(this.activeSlideId, {
        slide_id: this.activeSlideId,
        status: 'loading',
        retry_count: 0
      });
      this.loadSlideUrl(view.webContents, slide);
    }
  }

  setMonitoringMode(active: boolean): void {
    this.isMonitoringActive = active;

    if (!active) {
      this.showCursor();
      if (this.prewarmTimer) {
        clearTimeout(this.prewarmTimer);
        this.prewarmTimer = null;
      }
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
        const slideIdToClear = this.activeSlideId;
        this.activeSlideId = null;
        if (currentView) {
          setTimeout(() => {
            if (!this.isMonitoringActive) {
              try {
                this.viewHost.removeView(currentView);
              } catch {}
              const config = this.slideConfigs.get(slideIdToClear);
              if (config && !config.keep_alive) {
                currentView.webContents.setBackgroundThrottling(true);
              }
            }
          }, 80);
        }
      }
    } else {
      this.resetCursorIdleTimer();
      if (this.activeSlideId) {
        const currentView = this.views.get(this.activeSlideId);
        if (currentView) {
          currentView.webContents.setBackgroundThrottling(false);
          this.viewHost.addView(currentView);
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

    this.popupView = this.viewHost.createView({
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

    this.popupView.webContents.on('will-navigate', (event, targetUrl) => {
      if (!this.isAllowedProtocol(targetUrl)) {
        event.preventDefault();
      }
    });

    this.popupView.webContents.setWindowOpenHandler((details) => {
      if (this.isAllowedProtocol(details.url)) {
        this.popupView?.webContents.loadURL(details.url);
      }
      return { action: 'deny' };
    });

    this.viewHost.addView(this.popupView);
    this.ensureTopLayers();
    this.updateAllBounds();

    this.loadSlideUrl(this.popupView.webContents, url);

    this.callbacks.onPopupOpen(url, profile);
  }

  closePopup(): void {
    if (this.popupView) {
      this.viewHost.removeView(this.popupView);
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

  isMonitoring(): boolean {
    return this.isMonitoringActive;
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
        this.viewHost.removeView(view);
        this.activeSlideId = null;
      }
      view.webContents.close();
      this.views.delete(slideId);
    }
    this.slideConfigs.delete(slideId);
    this.slideStatuses.delete(slideId);
    this.retryCounts.delete(slideId);
    this.lastReloadTimes.delete(slideId);
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
          this.loadSlideUrl(view.webContents, config);
        }
      }
    }
  }

  destroy(): void {
    this.showCursor();
    if (this.prewarmTimer) {
      clearTimeout(this.prewarmTimer);
      this.prewarmTimer = null;
    }
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
    return session.fromPartition(partition);
  }

  private createSlideView(slide: WebsiteSlide): UnifiedView {
    const customSession = this.getSession(slide.session_profile || 'default');

    const view = this.viewHost.createView({
      webPreferences: {
        session: customSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: true
      }
    });

    view.setBackgroundColor('#09171b');
    if (this.window && !this.window.isDestroyed()) {
      const [w, h] = this.window.getContentSize();
      view.setBounds({ x: 0, y: 0, width: w, height: h });
    }

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
      const codeLabel = this.language === 'en' ? 'Code' : 'Kode';
      this.setSlideStatus(slide.id, {
        slide_id: slide.id,
        status: 'error',
        retry_count: currentRetries,
        error_message: `${errorDescription} (${codeLabel}: ${errorCode})`
      });

      this.scheduleAutoRetry(slide.id);
    });

    view.webContents.on('render-process-gone', (_event, details) => {
      const currentRetries = this.retryCounts.get(slide.id) || 0;
      const crashLabel = this.language === 'en' ? 'Renderer process terminated' : 'Proses renderer berhenti';
      this.setSlideStatus(slide.id, {
        slide_id: slide.id,
        status: 'crashed',
        retry_count: currentRetries,
        error_message: `${crashLabel}: ${details.reason}`
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

    this.loadSlideUrl(view.webContents, slide);

    return view;
  }

  refreshStandbySlide(): void {
    const slide = this.slideConfigs.get('system-standby');
    const view = this.views.get('system-standby');
    if (slide && view) {
      this.loadSlideUrl(view.webContents, slide);
    }
  }

  private loadSlideUrl(wc: Electron.WebContents, urlOrSlide: WebsiteSlide | string): void {
    const url = typeof urlOrSlide === 'string' ? urlOrSlide : urlOrSlide.url;
    if (isStandbySlide(urlOrSlide)) {
      let activeCount = 0;
      for (const s of this.slideConfigs.values()) {
        if (s.is_active) activeCount++;
      }
      const htmlPath = writeStandbyHtmlFile(url, Math.max(1, activeCount), this.language);
      wc.loadFile(htmlPath);
      return;
    }
    if (this.isAllowedProtocol(url)) {
      wc.loadURL(url);
    }
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
        this.loadSlideUrl(view.webContents, slide);
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
        if (input.type === 'mouseMove') {
          if (now - this.lastInteractionTime < 200) {
            return;
          }
          this.resetCursorIdleTimer();
        } else {
          this.showCursor();
          this.resetCursorIdleTimer();
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
      this.viewHost.bringToTop(this.popupView);
    }
    this.viewHost.bringToTop(this.uiView);
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
