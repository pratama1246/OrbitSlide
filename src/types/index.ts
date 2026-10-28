export interface WebsiteSlide {
  id: string;
  name: string;
  url: string;
  duration: number;
  sort_order: number;
  is_active: boolean;
  keep_alive: boolean;
  reload_interval?: number;
  session_profile: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppSettings {
  auto_start_monitoring: boolean;
  idle_timeout_seconds?: number;
  default_duration: number;
  start_fullscreen: boolean;
  theme: 'dark' | 'light' | 'system';
  slide_animation?: boolean;
  launch_on_startup?: boolean;
  ignore_certificate_errors?: boolean;
  language?: 'id' | 'en';
}

export type SlideLoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'crashed';

export interface SlideRuntimeStatus {
  slide_id: string;
  status: SlideLoadStatus;
  error_message?: string;
  http_code?: number;
  retry_count?: number;
  last_loaded_at?: number;
}

export interface SchedulerState {
  current_index: number;
  current_slide: WebsiteSlide | null;
  active_slides: WebsiteSlide[];
  slide_statuses: Record<string, SlideRuntimeStatus>;
  is_playing: boolean;
  is_paused_by_user: boolean;
  is_paused_by_interaction: boolean;
  is_popup_open: boolean;
  popup_url: string | null;
  popup_profile: string | null;
  remaining_seconds: number;
  total_slides: number;
  status: SlideLoadStatus;
  error_message?: string;
  transition_direction?: 'next' | 'prev' | 'none';
}

export interface KioskSystemInfo {
  open_at_login: boolean;
  exec_path: string;
  app_path: string;
  is_packaged: boolean;
  platform: string;
  hostname?: string;
  ip_address?: string;
  ip_addresses?: string[];
  os_release?: string;
}

export interface StandbyWallpaperItem {
  fileName: string;
  filePath: string;
  fileUrl: string;
  sizeBytes: number;
}

export interface AppSystemInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  arch: string;
  platform: string;
  os_type: string;
  os_release: string;
  user_data_path: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
  message?: string;
}

export interface MonitorAPI {
  getWebsites: () => Promise<WebsiteSlide[]>;
  saveWebsite: (slide: Omit<WebsiteSlide, 'created_at' | 'updated_at'>) => Promise<WebsiteSlide>;
  deleteWebsite: (id: string) => Promise<boolean>;
  reorderWebsites: (orderedIds: string[]) => Promise<boolean>;

  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
  getKioskInfo: () => Promise<KioskSystemInfo>;
  getAppInfo: () => Promise<AppSystemInfo>;
  openUserDataPath: () => Promise<void>;
  checkUpdate: () => Promise<UpdateCheckResult>;
  openExternal: (url: string) => Promise<void>;

  getStandbyWallpapers: () => Promise<StandbyWallpaperItem[]>;
  uploadStandbyWallpapers: () => Promise<StandbyWallpaperItem[]>;
  deleteStandbyWallpaper: (fileName: string) => Promise<StandbyWallpaperItem[]>;
  clearStandbyWallpapers: () => Promise<StandbyWallpaperItem[]>;

  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextSlide: () => Promise<void>;
  prevSlide: () => Promise<void>;
  jumpToSlide: (index: number) => Promise<void>;
  reloadCurrentSlide: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;

  openPopup: (url: string, profile?: string) => Promise<void>;
  closePopup: () => Promise<void>;
  setHudHovered: (hovered: boolean) => Promise<void>;
  setSlideMenuOpen: (open: boolean) => Promise<void>;

  clearSessionProfile: (profile: string) => Promise<boolean>;

  onSchedulerState: (callback: (state: SchedulerState) => void) => () => void;
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
  onHudVisibilityChange: (callback: (visible: boolean) => void) => () => void;
}

declare global {
  interface Window {
    monitorAPI: MonitorAPI;
  }
}
