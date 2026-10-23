import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { ConfigDatabase } from './database';
import { ViewManager } from './viewManager';
import { SlideScheduler } from './scheduler';
import { WebsiteSlide, AppSettings } from '../types';

let mainWindow: BrowserWindow | null = null;
let db: ConfigDatabase | null = null;
let viewManager: ViewManager | null = null;
let scheduler: SlideScheduler | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', false);
  });

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function initializeApp(): Promise<void> {
  db = new ConfigDatabase();
  await db.init();

  await createWindow();
  if (!mainWindow) return;

  const currentSettings = db.getSettings();

  viewManager = new ViewManager(mainWindow, {
    onStatusChange: (status) => {
      scheduler?.updateSlideStatus(status);
    },
    onUserInteraction: () => {
      scheduler?.handleUserInteraction();
    },
    onPopupOpen: () => {
      scheduler?.handlePopupState(true);
    },
    onPopupClose: () => {
      scheduler?.handlePopupState(false);
    }
  });

  scheduler = new SlideScheduler({
    onSlideChange: (slide) => {
      viewManager?.showSlide(slide);
    },
    onStateUpdate: (state) => {
      mainWindow?.webContents.send('scheduler:state', state);
    }
  });

  scheduler.setIdleTimeout(currentSettings.idle_timeout_seconds);
  const slides = db.getWebsites();
  scheduler.setSlides(slides);

  setupIpcHandlers();
  setupKeyboardShortcuts();

  if (currentSettings.start_fullscreen) {
    mainWindow.setFullScreen(true);
  }

  // Auto-start monitoring if configured and websites exist
  if (currentSettings.auto_start_monitoring && slides.some((s) => s.is_active)) {
    viewManager.setMonitoringMode(true);
    scheduler.start();
  }
}

function setupIpcHandlers(): void {
  if (!mainWindow || !db || !viewManager || !scheduler) return;

  ipcMain.handle('websites:get', () => {
    return db?.getWebsites() || [];
  });

  ipcMain.handle('websites:save', (_event, slideData: Omit<WebsiteSlide, 'created_at' | 'updated_at'>) => {
    if (!db || !scheduler) return null;
    const saved = db.saveWebsite(slideData);
    scheduler.setSlides(db.getWebsites());
    return saved;
  });

  ipcMain.handle('websites:delete', (_event, id: string) => {
    if (!db || !scheduler || !viewManager) return false;
    viewManager.clearSlideView(id);
    const deleted = db.deleteWebsite(id);
    scheduler.setSlides(db.getWebsites());
    return deleted;
  });

  ipcMain.handle('websites:reorder', (_event, orderedIds: string[]) => {
    if (!db || !scheduler) return false;
    const result = db.reorderWebsites(orderedIds);
    scheduler.setSlides(db.getWebsites());
    return result;
  });

  ipcMain.handle('settings:get', () => {
    return db?.getSettings();
  });

  ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
    if (!db || !scheduler) return false;
    const saved = db.saveSettings(settings);
    scheduler.setIdleTimeout(settings.idle_timeout_seconds);
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

  ipcMain.handle('popup:close', () => {
    viewManager?.closePopup();
  });

  ipcMain.handle('session:clear', async (_event, profile: string) => {
    if (!viewManager) return false;
    await viewManager.clearSessionProfile(profile);
    return true;
  });
}

function setupKeyboardShortcuts(): void {
  if (!mainWindow) return;

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11') {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
      return;
    }

    if (input.key === 'Escape') {
      if (viewManager?.isPopupOpen()) {
        viewManager.closePopup();
        return;
      }
      if (mainWindow?.isFullScreen()) {
        mainWindow.setFullScreen(false);
        return;
      }
    }

    if (input.key === ' ' && input.control === false && input.alt === false) {
      scheduler?.togglePlayPause();
      return;
    }

    if (input.key === 'ArrowRight') {
      scheduler?.next();
      return;
    }

    if (input.key === 'ArrowLeft') {
      scheduler?.prev();
      return;
    }

    if (input.key === 'F5' || (input.key === 'r' && input.control)) {
      viewManager?.reloadActiveSlide();
      return;
    }

    if (input.key.toLowerCase() === 's' && !input.control && !input.alt) {
      // Toggle back to settings if in monitoring mode
      viewManager?.setMonitoringMode(false);
      scheduler?.stop();
      return;
    }
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
