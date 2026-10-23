import React, { useState, useEffect } from 'react';
import { SchedulerState, SlideLoadStatus } from '../../types';

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
        return 'bg-emerald-400 shadow-emerald-400/50';
      case 'loading':
        return 'bg-sky-400 animate-pulse shadow-sky-400/50';
      case 'error':
      case 'crashed':
        return 'bg-rose-400 shadow-rose-400/50';
      default:
        return 'bg-slate-500';
    }
  };

  const totalDuration = state.current_slide?.duration || 15;
  const progressPercent = Math.min(
    100,
    Math.max(0, (state.remaining_seconds / totalDuration) * 100)
  );

  const isManuallyPaused = !state.is_playing || state.is_paused_by_user;
  const isInteractionPaused = state.is_paused_by_interaction;

  if (!isVisible) {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        className="fixed bottom-0 left-0 right-0 h-2 bg-transparent cursor-pointer"
        title="Arahkan kursor untuk menampilkan kontrol"
      />
    );
  }

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center w-full max-w-[820px] px-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Slide Selector Popover (FR-02 Panel Navigasi) */}
      {isMenuOpen && state.active_slides.length > 0 && (
        <div className="w-full max-w-md mb-2.5 bg-slate-900/98 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">
              Pilih Slide ({state.active_slides.length} Aktif)
            </span>
            <button
              type="button"
              onClick={toggleMenu}
              className="text-slate-400 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
            {state.active_slides.map((slide, idx) => {
              const isCurrent = idx === state.current_index;
              const slideSt = state.slide_statuses[slide.id]?.status || 'idle';
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => handleSelectSlide(idx)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition cursor-pointer focus:outline-none focus:bg-slate-800 ${
                    isCurrent
                      ? 'bg-indigo-950/60 text-white'
                      : 'hover:bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[11px] font-mono text-slate-400 w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(slideSt)}`} />
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate">{slide.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{slide.url}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {slide.duration}s
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded">
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

      {/* Main HUD Control Bar */}
      <div className="relative overflow-hidden flex items-center gap-3 bg-slate-900/95 border border-slate-700/90 rounded-2xl px-4 py-2.5 shadow-2xl">
        {/* Bottom Countdown Progress Line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800">
          <div
            className={`h-full transition-all duration-500 ${
              isManuallyPaused
                ? 'bg-amber-500'
                : isInteractionPaused
                  ? 'bg-sky-400'
                  : 'bg-indigo-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Slide Selector Trigger */}
        <button
          type="button"
          onClick={toggleMenu}
          title="Klik untuk memilih slide tertentu"
          className="flex items-center gap-2.5 pr-3 border-r border-slate-700/70 max-w-[240px] text-left hover:bg-slate-800/60 px-2 py-1 rounded-xl transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${getStatusDotClass(state.status)}`} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-100 truncate">
              {state.current_slide?.name || 'Monitoring'}
            </span>
            <span className="text-[10px] text-slate-300 flex items-center gap-1">
              <span>
                {state.total_slides > 0 ? `Slide ${state.current_index + 1} / ${state.total_slides}` : '0 Slide'}
              </span>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
              </svg>
            </span>
          </div>
        </button>

        {/* Timer & Auto-Pause Status Badge */}
        <div className="flex items-center justify-center px-2.5 py-1 bg-slate-800 rounded-lg text-xs font-mono shrink-0 min-w-[68px] text-center">
          {isManuallyPaused ? (
            <span className="text-amber-400 font-semibold text-[11px]">DIJEDA</span>
          ) : isInteractionPaused ? (
            <span className="text-sky-300 font-semibold text-[11px]" title="Dijeda otomatis karena aktivitas kursor/keyboard">
              AKTIF • {state.remaining_seconds}s
            </span>
          ) : (
            <span className="text-slate-200 font-semibold">{state.remaining_seconds}s</span>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            title="Slide Sebelumnya (Panah Kiri)"
            className="p-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            title={isManuallyPaused ? 'Lanjutkan Slideshow (Spasi)' : 'Jeda Slideshow (Spasi)'}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {isManuallyPaused ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            title="Slide Berikutnya (Panah Kanan)"
            className="p-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Auxiliary Controls */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700/70">
          <button
            type="button"
            onClick={onReload}
            title="Muat Ulang Halaman (F5)"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh (F11 / Esc)' : 'Layar Penuh (F11)'}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5M9 15l-5 5m0 0v-5m0 5h5m6-6l5-5m0 0v5m0-5h-5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Kembali ke Pengaturan (Alt+S)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Pengaturan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
