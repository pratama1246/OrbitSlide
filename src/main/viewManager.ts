import { BrowserWindow, WebContentsView, session } from 'electron';
import { WebsiteSlide, SlideRuntimeStatus } from '../types';

export interface ViewManagerCallbacks {
  onStatusChange: (status: SlideRuntimeStatus) => void;
  onUserInteraction: () => void;
  onPopupOpen: (url: string) => void;
  onPopupClose: () => void;
}

export class ViewManager {
  private window: BrowserWindow;
  private callbacks: ViewManagerCallbacks;
  private views: Map<string, WebContentsView> = new Map();
  private slideProfiles: Map<string, string> = new Map();
  private activeSlideId: string | null = null;
  private popupView: WebContentsView | null = null;
  private isMonitoringActive = false;

  constructor(window: BrowserWindow, callbacks: ViewManagerCallbacks) {
    this.window = window;
    this.callbacks = callbacks;

    this.window.on('resize', () => {
      this.updateActiveViewBounds();
      this.updatePopupViewBounds();
    });
  }

  showSlide(slide: WebsiteSlide): void {
    if (!this.isMonitoringActive) return;

    if (this.activeSlideId && this.activeSlideId !== slide.id) {
      const prevView = this.views.get(this.activeSlideId);
      if (prevView) {
        this.window.contentView.removeChildView(prevView);
      }
    }

    let view = this.views.get(slide.id);
    if (!view) {
      view = this.createSlideView(slide);
      this.views.set(slide.id, view);
      this.slideProfiles.set(slide.id, slide.session_profile || 'default');
    }

    this.activeSlideId = slide.id;
    this.window.contentView.addChildView(view);
    this.updateActiveViewBounds();

    if (this.popupView) {
      this.window.contentView.removeChildView(this.popupView);
      this.window.contentView.addChildView(this.popupView);
    }
  }

  reloadActiveSlide(): void {
    if (!this.activeSlideId) return;
    const view = this.views.get(this.activeSlideId);
    if (view) {
      this.callbacks.onStatusChange({
        slide_id: this.activeSlideId,
        status: 'loading'
      });
      view.webContents.reload();
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
    } else if (this.activeSlideId) {
      const currentView = this.views.get(this.activeSlideId);
      if (currentView) {
        this.window.contentView.addChildView(currentView);
        this.updateActiveViewBounds();
      }
    }
  }

  openPopup(url: string): void {
    if (this.popupView) {
      this.closePopup();
    }

    const profile = this.activeSlideId ? this.slideProfiles.get(this.activeSlideId) || 'default' : 'default';
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

    this.popupView.webContents.on('before-input-event', () => {
      this.callbacks.onUserInteraction();
    });

    this.popupView.webContents.setWindowOpenHandler((details) => {
      this.popupView?.webContents.loadURL(details.url);
      return { action: 'deny' };
    });

    this.window.contentView.addChildView(this.popupView);
    this.updatePopupViewBounds();
    this.popupView.webContents.loadURL(url);

    this.callbacks.onPopupOpen(url);
  }

  closePopup(): void {
    if (this.popupView) {
      this.window.contentView.removeChildView(this.popupView);
      this.popupView.webContents.close();
      this.popupView = null;
      this.callbacks.onPopupClose();
    }
  }

  isPopupOpen(): boolean {
    return this.popupView !== null;
  }

  clearSlideView(slideId: string): void {
    const view = this.views.get(slideId);
    if (view) {
      if (this.activeSlideId === slideId) {
        this.window.contentView.removeChildView(view);
        this.activeSlideId = null;
      }
      view.webContents.close();
      this.views.delete(slideId);
      this.slideProfiles.delete(slideId);
    }
  }

  clearSessionProfile(profileName: string): Promise<void> {
    const partition = `persist:${profileName || 'default'}`;
    const sess = session.fromPartition(partition);
    return sess.clearStorageData();
  }

  destroy(): void {
    this.closePopup();
    for (const [, view] of this.views) {
      view.webContents.close();
    }
    this.views.clear();
    this.slideProfiles.clear();
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
        sandbox: true
      }
    });

    view.webContents.on('did-start-loading', () => {
      this.callbacks.onStatusChange({
        slide_id: slide.id,
        status: 'loading'
      });
    });

    view.webContents.on('did-finish-load', () => {
      this.callbacks.onStatusChange({
        slide_id: slide.id,
        status: 'ready',
        last_loaded_at: Date.now()
      });
    });

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      if (errorCode === -3) return;

      this.callbacks.onStatusChange({
        slide_id: slide.id,
        status: 'error',
        error_message: `${errorDescription} (${errorCode})`
      });
    });

    view.webContents.on('render-process-gone', (_event, details) => {
      this.callbacks.onStatusChange({
        slide_id: slide.id,
        status: 'crashed',
        error_message: `Renderer process crashed: ${details.reason}`
      });
    });

    view.webContents.on('before-input-event', () => {
      this.callbacks.onUserInteraction();
    });

    view.webContents.setWindowOpenHandler((details) => {
      this.openPopup(details.url);
      return { action: 'deny' };
    });

    view.webContents.loadURL(slide.url);
    return view;
  }

  private updateActiveViewBounds(): void {
    if (!this.activeSlideId || !this.isMonitoringActive) return;
    const view = this.views.get(this.activeSlideId);
    if (!view) return;

    const [width, height] = this.window.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
  }

  private updatePopupViewBounds(): void {
    if (!this.popupView) return;

    const [width, height] = this.window.getContentSize();
    const topOffset = 56;
    this.popupView.setBounds({
      x: 0,
      y: topOffset,
      width,
      height: Math.max(0, height - topOffset)
    });
  }
}
