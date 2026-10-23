import React, { useState, useEffect } from 'react';
import { SchedulerState, SlideLoadStatus } from '../../types';
import { Logo } from './Logo';

interface FloatingHUDProps {
  state: SchedulerState;
  isVisible: boolean;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJumpToSlide: (index: number) => void;
  onTogglePlayPause: () => void;
  onReload: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
}

export const FloatingHUD: React.FC<FloatingHUDProps> = ({
  state,
  isVisible,
  isFullscreen,
  onPrev,
  onNext,
  onJumpToSlide,
  onTogglePlayPause,
  onReload,
  onToggleFullscreen,
  onOpenSettings
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isVisible && isMenuOpen) {
      setIsMenuOpen(false);
      window.monitorAPI?.setSlideMenuOpen(false);
    }
  }, [isVisible, isMenuOpen]);

  const toggleMenu = () => {
    const next = !isMenuOpen;
    setIsMenuOpen(next);
    window.monitorAPI?.setSlideMenuOpen(next);
  };

  const handleSelectSlide = (index: number) => {
    setIsMenuOpen(false);
    window.monitorAPI?.setSlideMenuOpen(false);
    onJumpToSlide(index);
  };

  const handleMouseEnter = () => {
    window.monitorAPI?.setHudHovered(true);
  };

  const handleMouseLeave = () => {
    window.monitorAPI?.setHudHovered(false);
  };

  const getStatusDotClass = (status?: SlideLoadStatus) => {
    switch (status) {
      case 'ready':
        return 'bg-emerald-500';
      case 'loading':
        return 'bg-sky-500 animate-pulse';
      case 'error':
      case 'crashed':
        return 'bg-rose-500';
      default:
        return 'bg-slate-400';
    }
  };

  const isManuallyPaused = !state.is_playing || state.is_paused_by_user;

  return (
    <>
      {/* Invisible top edge wake strip */}
      <div
        onMouseEnter={handleMouseEnter}
        className="fixed top-0 left-0 right-0 h-2.5 bg-transparent cursor-pointer z-50 pointer-events-auto"
        title="Arahkan kursor ke atas untuk menampilkan kontrol"
      />

      {/* Floating HUD Pill with Top-Down / Bottom-Up Slide Animation */}
      <div className="fixed top-2.5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`flex flex-col items-center transition-all duration-300 ease-out transform ${
            isVisible
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : '-translate-y-16 opacity-0 pointer-events-none'
          }`}
        >
          {/* Main Simplified HUD Pill */}
          <div className="w-[380px] max-w-[calc(100vw-24px)] overflow-hidden flex items-center justify-between gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-full px-2.5 py-1.5 text-slate-700 dark:text-slate-200">
        {/* Slide Selector Button */}
        <button
          type="button"
          onClick={toggleMenu}
          title={state.current_slide ? `${state.current_slide.name} (Klik untuk memilih slide)` : 'Pilih Slide'}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/70 transition cursor-pointer focus:outline-none"
        >
          <Logo size={18} variant="mark-gradient" className="shrink-0" />
          <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(state.status)}`} />
          <div
            key={state.current_slide?.id || 'none'}
            className={`flex items-center gap-1.5 min-w-0 flex-1 truncate ${
              state.transition_direction === 'prev'
                ? 'animate-slide-left'
                : state.transition_direction === 'next'
                  ? 'animate-slide-right'
                  : ''
            }`}
          >
            <span
              title={state.current_slide?.name || 'Monitoring'}
              className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block flex-1 text-left"
            >
              {state.current_slide?.name || 'Monitoring'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
              {state.total_slides > 0 ? `${state.current_index + 1}/${state.total_slides}` : '0/0'}
            </span>
          </div>
          <svg
            className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Subtle Divider */}
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            title="Slide Sebelumnya (Panah Kiri)"
            className="p-1 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-0 active:scale-90"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            title={isManuallyPaused ? 'Lanjutkan Slideshow (Spasi)' : 'Jeda Slideshow (Spasi)'}
            className="w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white flex items-center justify-center transition cursor-pointer focus:outline-none"
          >
            {isManuallyPaused ? (
              <svg className="w-3 h-3 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M7 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            title="Slide Berikutnya (Panah Kanan)"
            className="p-1 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-0 active:scale-90"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Subtle Divider */}
        <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

        {/* Secondary Action Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onReload}
            title="Muat Ulang Halaman (F5)"
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus:outline-none"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh (F11 / Esc)' : 'Layar Penuh (F11)'}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer focus:outline-none"
          >
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5M9 15l-5 5m0 0v-5m0 5h5m6-6l5-5m0 0v5m0-5h-5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Kembali ke Pengaturan (Alt+S)"
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer focus:outline-none"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide Selector Popover (Opens Downward) */}
      {isMenuOpen && state.active_slides.length > 0 && (
        <div className="w-[380px] max-w-[calc(100vw-24px)] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size={18} variant="mark-gradient" className="shrink-0" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Pilih Slide ({state.active_slides.length} Aktif)
              </span>
            </div>
            <button
              type="button"
              onClick={toggleMenu}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {state.active_slides.map((slide, idx) => {
              const isCurrent = idx === state.current_index;
              const slideSt = state.slide_statuses[slide.id]?.status || 'idle';
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => handleSelectSlide(idx)}
                  className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 transition cursor-pointer focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 ${
                    isCurrent
                      ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-white'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-slate-400 w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(slideSt)}`} />
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate">{slide.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{slide.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {slide.duration}s
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                        Aktif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
};
