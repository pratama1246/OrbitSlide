import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ConfigDatabase } from './database';
import { ViewManager } from './viewManager';
import { ViewHost, UnifiedView } from './viewHost';
import { SlideScheduler } from './scheduler';
import {
  listStandbyWallpapers,
  addStandbyWallpapersFromPaths,
  removeStandbyWallpaper,
  clearStandbyWallpapers
} from './standbyPage';
import { WebsiteSlide, AppSettings } from '../types';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let uiView: UnifiedView | null = null;
let db: ConfigDatabase | null = null;
let viewManager: ViewManager | null = null;
let scheduler: SlideScheduler | null = null;

export function isPrivateOrLocalHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const h = parsed.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h.endsWith('.local') ||
      h.endsWith('.internal') ||
      h.endsWith('.lan') ||
      h.endsWith('.home')
    ) {
      return true;
    }
    // IPv4 RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and CGNAT (100.64.0.0/10)
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    const match172 = h.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const second = parseInt(match172[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    const match100 = h.match(/^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match100) {
      const second = parseInt(match100[1], 10);
      if (second >= 64 && second <= 127) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Controlled certificate-error handler: only permits bypass for private/local IP dashboards when user setting is enabled
app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
  const currentSettings = db?.getSettings();
  const shouldIgnore = currentSettings ? currentSettings.ignore_certificate_errors !== false : true;
  if (shouldIgnore && isPrivateOrLocalHost(url)) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

async function initializeApp(): Promise<void> {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  db = new ConfigDatabase();
  await db.init();

  const getAppIcon = () => {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    const packagedPath = path.join(process.resourcesPath, 'resources', 'icons', iconName);
    if (app.isPackaged && fs.existsSync(packagedPath)) return packagedPath;
    const localPath = path.join(process.cwd(), 'resources', 'icons', iconName);
    if (fs.existsSync(localPath)) return localPath;
    const fallbackPng = path.join(process.cwd(), 'resources', 'icons', 'icon.png');
    if (fs.existsSync(fallbackPng)) return fallbackPng;
    return undefined;
  };

  mainWindow = new BrowserWindow({
    title: 'OrbitSlide',
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09171b',
    autoHideMenuBar: true,
    show: false,
    icon: getAppIcon()
  });

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  const viewHost = new ViewHost(mainWindow);

  uiView = viewHost.createView({
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  uiView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const currentSettings = db.getSettings();
  const initialSlides = db.getWebsites();

  viewManager = new ViewManager(mainWindow, viewHost, uiView, {
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
    onSlideChange: (slide, direction) => {
      viewManager?.showSlide(slide, direction);
    },
    onStateUpdate: (state) => {
      uiView?.webContents.send('scheduler:state', state);
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (state.is_playing && state.current_slide) {
          mainWindow.setTitle(`OrbitSlide - ${state.current_slide.name} (${state.current_index + 1}/${state.total_slides})`);
        } else {
          mainWindow.setTitle('OrbitSlide');
        }
      }
    }
  });

  scheduler.setDefaultDuration(currentSettings.default_duration);
  viewManager.setSlideAnimationEnabled(currentSettings.slide_animation !== false);
  viewManager.setLanguage(currentSettings.language === 'en' ? 'en' : 'id');
  applyLaunchOnStartup(!!currentSettings.launch_on_startup);
  viewManager.syncSlides(initialSlides);
  scheduler.setSlides(initialSlides);

  mainWindow.on('enter-full-screen', () => {
    uiView?.webContents.send('window:fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    uiView?.webContents.send('window:fullscreen-change', false);
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
    await uiView.webContents.loadFile(path.join(currentDir, '../dist/index.html'));
  }

  if (currentSettings.start_fullscreen) {
    mainWindow.setFullScreen(true);
  }

  mainWindow.show();

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
        viewManager.setMonitoringMode(false);
        scheduler.stop();
      }
      break;
  }
}

function applyLaunchOnStartup(enable: boolean): void {
  try {
    if (process.platform === 'win32') {
      if (app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: enable
        });
      } else {
        // Ensure dev electron binary is not left registered in Windows Startup alongside packaged app
        app.setLoginItemSettings({
          openAtLogin: false,
          path: process.execPath,
          args: [path.resolve(process.cwd())]
        });
      }
    } else if (process.platform === 'darwin' && app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: enable
      });
    }
  } catch (err) {
    console.error('Gagal menerapkan konfigurasi auto-start Windows:', err);
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
    if (!db || !scheduler || !viewManager) return false;
    const saved = db.saveSettings(settings);
    scheduler.setDefaultDuration(settings.default_duration);
    viewManager.setSlideAnimationEnabled(settings.slide_animation !== false);
    viewManager.setLanguage(settings.language === 'en' ? 'en' : 'id');
    applyLaunchOnStartup(!!settings.launch_on_startup);
    const updatedSlides = db.getWebsites();
    viewManager.syncSlides(updatedSlides);
    scheduler.setSlides(updatedSlides);
    return saved;
  });

  ipcMain.handle('system:get-kiosk-info', () => {
    let openAtLogin = false;
    try {
      openAtLogin = app.getLoginItemSettings().openAtLogin;
    } catch {
      openAtLogin = false;
    }
    const appDir = app.isPackaged ? process.resourcesPath : process.cwd();

    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      const ifaceList = interfaces[name];
      if (ifaceList) {
        for (const item of ifaceList) {
          if (item.family === 'IPv4' && !item.internal) {
            ips.push(item.address);
          }
        }
      }
    }

    return {
      open_at_login: openAtLogin,
      exec_path: process.execPath,
      app_path: appDir,
      is_packaged: app.isPackaged,
      platform: process.platform,
      hostname: os.hostname(),
      ip_address: ips[0] || '127.0.0.1',
      ip_addresses: ips,
      os_release: `${os.type()} ${os.release()}`
    };
  });

  ipcMain.handle('monitoring:start', () => {
    viewManager?.setMonitoringMode(true);
    scheduler?.start();
  });

  ipcMain.handle('monitoring:stop', () => {
    viewManager?.setMonitoringMode(false);
    scheduler?.stop();
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

  ipcMain.handle('standby:get-wallpapers', () => {
    return listStandbyWallpapers();
  });

  ipcMain.handle('standby:upload-wallpapers', async () => {
    if (!mainWindow) return listStandbyWallpapers();
    const current = listStandbyWallpapers();
    if (current.length >= 3) {
      return current;
    }
    const isEn = db?.getSettings()?.language === 'en';
    const result = await dialog.showOpenDialog(mainWindow, {
      title: isEn ? 'Select Standby Wallpaper Images' : 'Pilih Gambar Wallpaper Lock Screen',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: isEn ? 'Wallpaper Images' : 'Gambar Wallpaper',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif']
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return listStandbyWallpapers();
    }

    const updated = addStandbyWallpapersFromPaths(result.filePaths);
    viewManager?.refreshStandbySlide();
    return updated;
  });

  ipcMain.handle('standby:delete-wallpaper', (_event, fileName: string) => {
    const updated = removeStandbyWallpaper(fileName);
    viewManager?.refreshStandbySlide();
    return updated;
  });

  ipcMain.handle('standby:clear-wallpapers', () => {
    const updated = clearStandbyWallpapers();
    viewManager?.refreshStandbySlide();
    return updated;
  });

  ipcMain.handle('system:get-app-info', () => {
    return {
      version: app.getVersion(),
      electron: process.versions.electron || '',
      chrome: process.versions.chrome || '',
      node: process.versions.node || '',
      arch: process.arch,
      platform: process.platform,
      os_type: os.type(),
      os_release: os.release(),
      user_data_path: app.getPath('userData')
    };
  });

  ipcMain.handle('system:open-user-data', () => {
    // Guard against kiosk breakout during active monitoring
    if (viewManager?.isMonitoring()) {
      console.warn('Blocked opening userData in OS Explorer while monitoring is active.');
      return;
    }
    shell.openPath(app.getPath('userData'));
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(initializeApp);
}

app.on('window-all-closed', () => {
  viewManager?.destroy();
  scheduler?.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
