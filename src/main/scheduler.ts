import { WebsiteSlide, SchedulerState, SlideLoadStatus, SlideRuntimeStatus } from '../types';

export interface SchedulerCallbacks {
  onSlideChange: (slide: WebsiteSlide) => void;
  onStateUpdate: (state: SchedulerState) => void;
}

export class SlideScheduler {
  private slides: WebsiteSlide[] = [];
  private currentIndex = 0;
  private remainingSeconds = 0;
  private isPlaying = false;
  private isPausedByUser = false;
  private isPausedByInteraction = false;
  private isPopupOpen = false;
  private idleTimeoutSeconds = 30;

  private ticker: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private slideStatuses: Map<string, SlideRuntimeStatus> = new Map();

  private callbacks: SchedulerCallbacks;

  constructor(callbacks: SchedulerCallbacks) {
    this.callbacks = callbacks;
  }

  setIdleTimeout(seconds: number): void {
    this.idleTimeoutSeconds = Math.max(5, seconds);
  }

  setSlides(slides: WebsiteSlide[]): void {
    this.slides = slides.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

    if (this.currentIndex >= this.slides.length) {
      this.currentIndex = 0;
    }

    if (this.slides.length > 0 && this.remainingSeconds === 0) {
      this.remainingSeconds = this.slides[this.currentIndex]?.duration || 15;
    }

    this.emitState();
  }

  start(): void {
    if (this.slides.length === 0) return;

    this.isPlaying = true;
    this.isPausedByUser = false;
    this.isPausedByInteraction = false;

    const currentSlide = this.getCurrentSlide();
    if (currentSlide) {
      this.remainingSeconds = currentSlide.duration;
      this.callbacks.onSlideChange(currentSlide);
    }

    this.startTicker();
    this.emitState();
  }

  stop(): void {
    this.isPlaying = false;
    this.isPausedByUser = false;
    this.isPausedByInteraction = false;
    this.clearTicker();
    this.clearIdleTimer();
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
    this.activateCurrentSlide();
  }

  prev(): void {
    if (this.slides.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.activateCurrentSlide();
  }

  jump(index: number): void {
    if (index < 0 || index >= this.slides.length) return;
    this.currentIndex = index;
    this.activateCurrentSlide();
  }

  handleUserInteraction(): void {
    if (!this.isPlaying || this.isPausedByUser) return;

    this.isPausedByInteraction = true;
    this.clearIdleTimer();
    this.emitState();

    this.idleTimer = setTimeout(() => {
      this.isPausedByInteraction = false;
      this.idleTimer = null;
      this.emitState();
    }, this.idleTimeoutSeconds * 1000);
  }

  handlePopupState(isOpen: boolean): void {
    this.isPopupOpen = isOpen;
    this.emitState();
  }

  updateSlideStatus(status: SlideRuntimeStatus): void {
    this.slideStatuses.set(status.slide_id, status);
    const currentSlide = this.getCurrentSlide();
    if (currentSlide && currentSlide.id === status.slide_id) {
      this.emitState();
    }
  }

  getCurrentSlide(): WebsiteSlide | null {
    return this.slides[this.currentIndex] || null;
  }

  destroy(): void {
    this.clearTicker();
    this.clearIdleTimer();
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

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private tick(): void {
    if (!this.isPlaying || this.isPausedByUser || this.isPausedByInteraction || this.isPopupOpen) {
      return;
    }

    if (this.remainingSeconds > 1) {
      this.remainingSeconds--;
      this.emitState();
    } else {
      this.next();
    }
  }

  private activateCurrentSlide(): void {
    const slide = this.getCurrentSlide();
    if (slide) {
      this.remainingSeconds = slide.duration;
      this.callbacks.onSlideChange(slide);
    }
    this.emitState();
  }

  private emitState(): void {
    const currentSlide = this.getCurrentSlide();
    const runtime = currentSlide ? this.slideStatuses.get(currentSlide.id) : undefined;

    const state: SchedulerState = {
      current_index: this.currentIndex,
      current_slide: currentSlide,
      is_playing: this.isPlaying,
      is_paused_by_user: this.isPausedByUser,
      is_paused_by_interaction: this.isPausedByInteraction,
      is_popup_open: this.isPopupOpen,
      remaining_seconds: this.remainingSeconds,
      total_slides: this.slides.length,
      status: (runtime?.status || 'idle') as SlideLoadStatus,
      error_message: runtime?.error_message
    };

    this.callbacks.onStateUpdate(state);
  }
}
