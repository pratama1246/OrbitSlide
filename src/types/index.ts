export interface WebsiteSlide {
  id: string;
  name: string;
  url: string;
  duration: number;
  sort_order: number;
  is_active: boolean;
  keep_alive: boolean;
  session_profile: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppSettings {
  auto_start_monitoring: boolean;
  idle_timeout_seconds: number;
  default_duration: number;
  start_fullscreen: boolean;
}

export type SlideLoadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'crashed';

export interface SlideRuntimeStatus {
  slide_id: string;
  status: SlideLoadStatus;
  error_message?: string;
  http_code?: number;
  last_loaded_at?: number;
}

export interface SchedulerState {
  current_index: number;
  current_slide: WebsiteSlide | null;
  is_playing: boolean;
  is_paused_by_user: boolean;
  is_paused_by_interaction: boolean;
  is_popup_open: boolean;
  remaining_seconds: number;
  total_slides: number;
  status: SlideLoadStatus;
  error_message?: string;
}

export interface MonitorAPI {
  // Website configuration
  getWebsites: () => Promise<WebsiteSlide[]>;
  saveWebsite: (slide: Omit<WebsiteSlide, 'created_at' | 'updated_at'>) => Promise<WebsiteSlide>;
  deleteWebsite: (id: string) => Promise<boolean>;
  reorderWebsites: (orderedIds: string[]) => Promise<boolean>;

  // App settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<boolean>;

  // Monitoring & slideshow controls
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextSlide: () => Promise<void>;
  prevSlide: () => Promise<void>;
  jumpToSlide: (index: number) => Promise<void>;
  reloadCurrentSlide: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  closePopup: () => Promise<void>;

  // Session profile management
  clearSessionProfile: (profile: string) => Promise<boolean>;

  // Event listeners
  onSchedulerState: (callback: (state: SchedulerState) => void) => () => void;
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
}

declare global {
  interface Window {
    monitorAPI: MonitorAPI;
  }
}
