import { BrowserWindow, WebPreferences, WebContentsView } from 'electron';

export type UnifiedView = WebContentsView;

export class ViewHost {
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  createView(options?: { webPreferences?: WebPreferences }): WebContentsView {
    return new WebContentsView(options);
  }

  addView(view: WebContentsView): void {
    this.window.contentView.addChildView(view);
  }

  removeView(view: WebContentsView): void {
    try {
      this.window.contentView.removeChildView(view);
    } catch {}
  }

  bringToTop(view: WebContentsView): void {
    this.window.contentView.addChildView(view);
  }
}
