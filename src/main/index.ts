import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigDatabase } from './database';
import { ViewManager } from './viewManager';
import { SlideScheduler } from './scheduler';
import { WebsiteSlide, AppSettings } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let uiView: WebContentsView | null = null;
let db: ConfigDatabase | null = null;
let viewManager: ViewManager | null = null;
let scheduler: SlideScheduler | null = null;

async function initializeApp(): Promise<void> {
  db = new ConfigDatabase();
  await db.init();

  const currentSettings = db.getSettings();
  const initialSlides = db.getWebsites();
  const isDark = currentSettings.theme !== 'light';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: isDark ? '#020617' : '#f8fafc',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: isDark ? '#0f172a' : '#ffffff',
      symbolColor: isDark ? '#cbd5e1' : '#1e293b',
      height: 42
    },
    show: false
  });

  uiView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  let normalBounds = {
    width: 1280,
    height: 800,
    x: undefined as number | undefined,
    y: undefined as number | undefined
  };

  const updateNormalBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isFullScreen() && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const b = mainWindow.getBounds();
      if (b.width >= 900 && b.height >= 600) {
        normalBounds = { width: b.width, height: b.height, x: b.x, y: b.y };
      }
    }
  };

  mainWindow.on('resize', updateNormalBounds);
  mainWindow.on('move', updateNormalBounds);

  viewManager = new ViewManager(mainWindow, uiView, {
    onStatusChange: (status) => {
      scheduler?.updateSlideStatus(status);
    },
    onUserInteraction: () => {
      scheduler?.handleUserInteraction();
    },
    onPopupOpen: (url, profile) => {
      scheduler?.handlePopupState(true, url, profile);
    },
    onPopupClose: () => {
      scheduler?.handlePopupState(false);
    },
    onHudVisibilityChange: (visible) => {
      uiView?.webContents.send('hud:visibility', visible);
    },
    onShortcut: (action) => {
      handleShortcutAction(action);
    }
  });

  scheduler = new SlideScheduler({
    onSlideChange: (slide) => {
      viewManager?.showSlide(slide);
    },
    onStateUpdate: (state) => {
      uiView?.webContents.send('scheduler:state', state);
    }
  });

  scheduler.setIdleTimeout(currentSettings.idle_timeout_seconds);
  viewManager.syncSlides(initialSlides);
  scheduler.setSlides(initialSlides);

  mainWindow.on('enter-full-screen', () => {
    uiView?.webContents.send('window:fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const b = mainWindow.getBounds();
      if (b.height < 600 || b.width < 900) {
        if (normalBounds.x !== undefined && normalBounds.y !== undefined) {
          mainWindow.setBounds(normalBounds);
        } else {
          mainWindow.setSize(1280, 800);
          mainWindow.center();
        }
      }
    }
    uiView?.webContents.send('window:fullscreen-change', false);
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const b = mainWindow.getBounds();
      if (b.height < 600 || b.width < 900) {
        mainWindow.setSize(1280, 800);
        mainWindow.center();
      }
    }
  });

  // Register IPC handlers before loading UI so initial requests never race
  setupIpcHandlers();

  uiView.webContents.on('did-finish-load', () => {
    scheduler?.emitState();
    uiView?.webContents.send('window:fullscreen-change', mainWindow?.isFullScreen() || false);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await uiView.webContents.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await uiView.webContents.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.show();

  const initB = mainWindow.getBounds();
  if (initB.height < 600 || initB.width < 900) {
    mainWindow.setSize(1280, 800);
    mainWindow.center();
  }

  if (currentSettings.start_fullscreen) {
    mainWindow.setFullScreen(true);
  }

  if (currentSettings.auto_start_monitoring && initialSlides.some((s) => s.is_active)) {
    viewManager.setMonitoringMode(true);
    scheduler.start();
  }
}

function handleShortcutAction(
  action: 'toggle-fullscreen' | 'escape' | 'toggle-play' | 'next' | 'prev' | 'reload' | 'settings'
): void {
  if (!mainWindow || !viewManager || !scheduler) return;

  switch (action) {
    case 'toggle-fullscreen':
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      break;
    case 'escape':
      if (viewManager.isPopupOpen()) {
        viewManager.closePopup();
      } else if (mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(false);
      }
      break;
    case 'toggle-play':
      if (scheduler.getState().is_playing) {
        scheduler.togglePlayPause();
      }
      break;
    case 'next':
      if (scheduler.getState().is_playing) {
        scheduler.next();
      }
      break;
    case 'prev':
      if (scheduler.getState().is_playing) {
        scheduler.prev();
      }
      break;
    case 'reload':
      if (scheduler.getState().is_playing) {
        viewManager.reloadActiveSlide();
      }
      break;
    case 'settings':
      if (scheduler.getState().is_playing) {
        scheduler.stop();
        viewManager.setMonitoringMode(false);
      }
      break;
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('websites:get', () => {
    return db?.getWebsites() || [];
  });

  ipcMain.handle('websites:save', (_event, slideData: Omit<WebsiteSlide, 'created_at' | 'updated_at'>) => {
    if (!db || !scheduler || !viewManager) {
      throw new Error('Layanan database belum siap');
    }
    const saved = db.saveWebsite(slideData);
    const updatedSlides = db.getWebsites();
    viewManager.syncSlides(updatedSlides);
    scheduler.setSlides(updatedSlides);
    return saved;
  });

  ipcMain.handle('websites:delete', (_event, id: string) => {
    if (!db || !scheduler || !viewManager) return false;
    viewManager.clearSlideView(id);
    const deleted = db.deleteWebsite(id);
    const updatedSlides = db.getWebsites();
    viewManager.syncSlides(updatedSlides);
    scheduler.setSlides(updatedSlides);
    return deleted;
  });

  ipcMain.handle('websites:reorder', (_event, orderedIds: string[]) => {
    if (!db || !scheduler || !viewManager) return false;
    const result = db.reorderWebsites(orderedIds);
    const updatedSlides = db.getWebsites();
    viewManager.syncSlides(updatedSlides);
    scheduler.setSlides(updatedSlides);
    return result;
  });

  ipcMain.handle('settings:get', () => {
    return db?.getSettings();
  });

  ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
    if (!db || !scheduler) return false;
    const saved = db.saveSettings(settings);
    scheduler.setIdleTimeout(settings.idle_timeout_seconds);

    if (mainWindow && !mainWindow.isDestroyed() && process.platform === 'win32') {
      const isDark = settings.theme !== 'light';
      mainWindow.setTitleBarOverlay({
        color: isDark ? '#0f172a' : '#ffffff',
        symbolColor: isDark ? '#cbd5e1' : '#1e293b',
        height: 42
      });
      mainWindow.setBackgroundColor(isDark ? '#020617' : '#f8fafc');
    }

    return saved;
  });

  ipcMain.handle('monitoring:start', () => {
    viewManager?.setMonitoringMode(true);
    scheduler?.start();
  });

  ipcMain.handle('monitoring:stop', () => {
    scheduler?.stop();
    viewManager?.setMonitoringMode(false);
  });

  ipcMain.handle('monitoring:toggle-play-pause', () => {
    scheduler?.togglePlayPause();
  });

  ipcMain.handle('monitoring:next', () => {
    scheduler?.next();
  });

  ipcMain.handle('monitoring:prev', () => {
    scheduler?.prev();
  });

  ipcMain.handle('monitoring:jump', (_event, index: number) => {
    scheduler?.jump(index);
  });

  ipcMain.handle('monitoring:reload', () => {
    viewManager?.reloadActiveSlide();
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (!mainWindow) return false;
    const nextState = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(nextState);
    return nextState;
  });

  ipcMain.handle('popup:open', (_event, url: string, profile?: string) => {
    viewManager?.openPopup(url, profile);
  });

  ipcMain.handle('popup:close', () => {
    viewManager?.closePopup();
  });

  ipcMain.handle('hud:hover', (_event, hovered: boolean) => {
    viewManager?.setHudHovered(hovered);
  });

  ipcMain.handle('hud:slide-menu', (_event, open: boolean) => {
    viewManager?.setSlideMenuOpen(open);
  });

  ipcMain.handle('session:clear', async (_event, profile: string) => {
    if (!viewManager) return false;
    await viewManager.clearSessionProfile(profile);
    return true;
  });
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  viewManager?.destroy();
  scheduler?.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
