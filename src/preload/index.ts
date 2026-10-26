import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { SchedulerState, MonitorAPI } from '../types';

const monitorAPI: MonitorAPI = {
  getWebsites: () => ipcRenderer.invoke('websites:get'),
  saveWebsite: (slide) => ipcRenderer.invoke('websites:save', slide),
  deleteWebsite: (id) => ipcRenderer.invoke('websites:delete', id),
  reorderWebsites: (orderedIds) => ipcRenderer.invoke('websites:reorder', orderedIds),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getKioskInfo: () => ipcRenderer.invoke('system:get-kiosk-info'),
  getAppInfo: () => ipcRenderer.invoke('system:get-app-info'),
  openUserDataPath: () => ipcRenderer.invoke('system:open-user-data'),

  getStandbyWallpapers: () => ipcRenderer.invoke('standby:get-wallpapers'),
  uploadStandbyWallpapers: () => ipcRenderer.invoke('standby:upload-wallpapers'),
  deleteStandbyWallpaper: (fileName) => ipcRenderer.invoke('standby:delete-wallpaper', fileName),
  clearStandbyWallpapers: () => ipcRenderer.invoke('standby:clear-wallpapers'),

  startMonitoring: () => ipcRenderer.invoke('monitoring:start'),
  stopMonitoring: () => ipcRenderer.invoke('monitoring:stop'),
  togglePlayPause: () => ipcRenderer.invoke('monitoring:toggle-play-pause'),
  nextSlide: () => ipcRenderer.invoke('monitoring:next'),
  prevSlide: () => ipcRenderer.invoke('monitoring:prev'),
  jumpToSlide: (index) => ipcRenderer.invoke('monitoring:jump', index),
  reloadCurrentSlide: () => ipcRenderer.invoke('monitoring:reload'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),

  openPopup: (url, profile) => ipcRenderer.invoke('popup:open', url, profile),
  closePopup: () => ipcRenderer.invoke('popup:close'),
  setHudHovered: (hovered) => ipcRenderer.invoke('hud:hover', hovered),
  setSlideMenuOpen: (open) => ipcRenderer.invoke('hud:slide-menu', open),

  clearSessionProfile: (profile) => ipcRenderer.invoke('session:clear', profile),

  onSchedulerState: (callback: (state: SchedulerState) => void) => {
    const handler = (_event: IpcRendererEvent, state: SchedulerState) => callback(state);
    ipcRenderer.on('scheduler:state', handler);
    return () => {
      ipcRenderer.removeListener('scheduler:state', handler);
    };
  },

  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('window:fullscreen-change', handler);
    return () => {
      ipcRenderer.removeListener('window:fullscreen-change', handler);
    };
  },

  onHudVisibilityChange: (callback: (visible: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, visible: boolean) => callback(visible);
    ipcRenderer.on('hud:visibility', handler);
    return () => {
      ipcRenderer.removeListener('hud:visibility', handler);
    };
  }
};

contextBridge.exposeInMainWorld('monitorAPI', monitorAPI);
