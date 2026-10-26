import { BrowserWindow, Rectangle, WebPreferences } from 'electron';
import * as electron from 'electron';

export interface UnifiedView {
  readonly webContents: Electron.WebContents;
  readonly raw: any;
  setBounds(bounds: Rectangle): void;
  setBackgroundColor(color: string): void;
}

export class UnifiedViewWrapper implements UnifiedView {
  constructor(readonly raw: any) {}

  get webContents(): Electron.WebContents {
    return this.raw.webContents;
  }

  setBounds(bounds: Rectangle): void {
    this.raw.setBounds(bounds);
  }

  setBackgroundColor(color: string): void {
    this.raw.setBackgroundColor(color);
  }
}

export class ViewHost {
  private window: BrowserWindow;
  readonly isModern: boolean;

  constructor(window: BrowserWindow) {
    this.window = window;
    // Electron 30+ has contentView with addChildView on BrowserWindow and WebContentsView class
    const winAny = window as any;
    const electronAny = electron as any;
    this.isModern =
      typeof winAny.contentView?.addChildView === 'function' &&
      typeof electronAny.WebContentsView === 'function';
  }

  createView(options?: { webPreferences?: WebPreferences }): UnifiedView {
    const electronAny = electron as any;
    if (this.isModern) {
      const WebContentsViewClass = electronAny.WebContentsView;
      return new UnifiedViewWrapper(new WebContentsViewClass(options));
    } else {
      const BrowserViewClass = electronAny.BrowserView;
      return new UnifiedViewWrapper(new BrowserViewClass(options));
    }
  }

  addView(view: UnifiedView): void {
    const winAny = this.window as any;
    if (this.isModern) {
      winAny.contentView.addChildView(view.raw);
    } else {
      this.window.addBrowserView(view.raw);
    }
  }

  removeView(view: UnifiedView): void {
    try {
      const winAny = this.window as any;
      if (this.isModern) {
        winAny.contentView.removeChildView(view.raw);
      } else {
        this.window.removeBrowserView(view.raw);
      }
    } catch {}
  }

  bringToTop(view: UnifiedView): void {
    const winAny = this.window as any;
    if (this.isModern) {
      winAny.contentView.addChildView(view.raw);
    } else {
      winAny.setTopBrowserView?.(view.raw);
    }
  }
}
