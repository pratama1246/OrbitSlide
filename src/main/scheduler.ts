import { WebsiteSlide, SchedulerState, SlideLoadStatus, SlideRuntimeStatus } from '../types';

export interface SchedulerCallbacks {
  onSlideChange: (slide: WebsiteSlide, direction: 'next' | 'prev' | 'none') => void;
  onStateUpdate: (state: SchedulerState) => void;
}

export class SlideScheduler {
  private slides: WebsiteSlide[] = [];
  private currentIndex = 0;
  private remainingSeconds = 0;
  private isPlaying = false;
  private isPausedByUser = false;
  private isPopupOpen = false;
  private popupUrl: string | null = null;
  private popupProfile: string | null = null;

  private ticker: NodeJS.Timeout | null = null;
  private slideStatuses: Map<string, SlideRuntimeStatus> = new Map();
  private cachedStatusesRecord: Record<string, SlideRuntimeStatus> = {};
  private currentDirection: 'next' | 'prev' | 'none' = 'none';
  private defaultDuration = 15;

  private callbacks: SchedulerCallbacks;

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks;
  }

  setDefaultDuration(seconds: number): void {
    this.defaultDuration = Math.max(3, seconds);
  }

  setSlides(slides: WebsiteSlide[]): void {
    const currentSlideId = this.slides[this.currentIndex]?.id;
    this.slides = slides.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

    if (currentSlideId) {
      const newIndex = this.slides.findIndex((s) => s.id === currentSlideId);
      if (newIndex !== -1) {
        this.currentIndex = newIndex;
      } else if (this.currentIndex >= this.slides.length) {
        this.currentIndex = 0;
      }
    } else if (this.currentIndex >= this.slides.length) {
      this.currentIndex = 0;
    }

    if (this.slides.length > 0 && this.remainingSeconds === 0) {
      this.remainingSeconds = this.slides[this.currentIndex]?.duration || this.defaultDuration;
    }

    this.emitState();
  }

  start(): void {
    if (this.slides.length === 0) return;

    this.isPlaying = true;
    this.isPausedByUser = false;
    this.currentDirection = 'none';

    const currentSlide = this.getCurrentSlide();
    if (currentSlide) {
      this.remainingSeconds = currentSlide.duration || this.defaultDuration;
      this.callbacks.onSlideChange(currentSlide, 'none');
    }

    this.startTicker();
    this.emitState();
  }

  stop(): void {
    this.isPlaying = false;
    this.isPausedByUser = false;
    this.currentDirection = 'none';
    this.clearTicker();
    this.emitState();
  }

  togglePlayPause(): void {
    if (!this.isPlaying) {
      this.start();
      return;
    }

    this.isPausedByUser = !this.isPausedByUser;
    this.emitState();
  }

  next(): void {
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.slides.length;
    this.activateCurrentSlide('next');
  }

  prev(): void {
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.activateCurrentSlide('prev');
  }

  jump(index: number): void {
    if (index < 0 || index >= this.slides.length) return;
    if (index === this.currentIndex) return;
    const direction = index > this.currentIndex ? 'next' : 'prev';
    this.currentIndex = index;
    this.activateCurrentSlide(direction);
  }

  resetCurrentSlideTimer(): void {
    if (!this.isPlaying || this.isPausedByUser || this.isPopupOpen) return;
    const currentSlide = this.getCurrentSlide();
    if (currentSlide) {
      this.remainingSeconds = currentSlide.duration || this.defaultDuration;
      this.emitState();
    }
  }

  handlePopupState(isOpen: boolean, url?: string, profile?: string): void {
    this.isPopupOpen = isOpen;
    this.popupUrl = isOpen ? (url || null) : null;
    this.popupProfile = isOpen ? (profile || 'default') : null;
    this.emitState();
  }

  updateSlideStatus(status: SlideRuntimeStatus): void {
    this.slideStatuses.set(status.slide_id, status);
    this.cachedStatusesRecord[status.slide_id] = status;
    this.emitState();
  }

  getCurrentSlide(): WebsiteSlide | null {
    return this.slides[this.currentIndex] || null;
  }

  getState(): SchedulerState {
    const currentSlide = this.getCurrentSlide();
    const runtime = currentSlide ? this.slideStatuses.get(currentSlide.id) : undefined;

    return {
      current_index: this.currentIndex,
      current_slide: currentSlide,
      active_slides: this.slides,
      slide_statuses: this.cachedStatusesRecord,
      is_playing: this.isPlaying,
      is_paused_by_user: this.isPausedByUser,
      is_paused_by_interaction: false,
      is_popup_open: this.isPopupOpen,
      popup_url: this.popupUrl,
      popup_profile: this.popupProfile,
      remaining_seconds: this.remainingSeconds,
      total_slides: this.slides.length,
      status: (runtime?.status || 'idle') as SlideLoadStatus,
      error_message: runtime?.error_message,
      transition_direction: this.currentDirection
    };
  }

  emitState(): void {
    this.callbacks.onStateUpdate(this.getState());
  }

  destroy(): void {
    this.clearTicker();
  }

  private startTicker(): void {
    this.clearTicker();
    this.ticker = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private clearTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private tick(): void {
    if (!this.isPlaying || this.isPausedByUser || this.isPopupOpen) {
      return;
    }

    if (this.remainingSeconds > 1) {
      this.remainingSeconds--;
      this.emitState();
    } else {
      this.next();
    }
  }

  private activateCurrentSlide(direction: 'next' | 'prev' | 'none' = 'next'): void {
    const slide = this.getCurrentSlide();
    this.currentDirection = direction;
    if (slide) {
      this.remainingSeconds = slide.duration || this.defaultDuration;
      this.callbacks.onSlideChange(slide, direction);
    }
    this.emitState();
  }
}
