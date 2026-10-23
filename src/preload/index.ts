import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { SchedulerState, MonitorAPI } from '../types';

const monitorAPI: MonitorAPI = {
  getWebsites: () => ipcRenderer.invoke('websites:get'),
  saveWebsite: (slide) => ipcRenderer.invoke('websites:save', slide),
  deleteWebsite: (id) => ipcRenderer.invoke('websites:delete', id),
  reorderWebsites: (orderedIds) => ipcRenderer.invoke('websites:reorder', orderedIds),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  startMonitoring: () => ipcRenderer.invoke('monitoring:start'),
  stopMonitoring: () => ipcRenderer.invoke('monitoring:stop'),
  togglePlayPause: () => ipcRenderer.invoke('monitoring:toggle-play-pause'),
  nextSlide: () => ipcRenderer.invoke('monitoring:next'),
  prevSlide: () => ipcRenderer.invoke('monitoring:prev'),
  jumpToSlide: (index) => ipcRenderer.invoke('monitoring:jump', index),
  reloadCurrentSlide: () => ipcRenderer.invoke('monitoring:reload'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  closePopup: () => ipcRenderer.invoke('popup:close'),

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
  }
};

contextBridge.exposeInMainWorld('monitorAPI', monitorAPI);
