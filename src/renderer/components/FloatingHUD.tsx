import React, { useState, useEffect, useRef } from 'react';
import { SchedulerState } from '../../types';

interface FloatingHUDProps {
  state: SchedulerState;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlayPause: () => void;
  onReload: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
}

export const FloatingHUD: React.FC<FloatingHUDProps> = ({
  state,
  isFullscreen,
  onPrev,
  onNext,
  onTogglePlayPause,
  onReload,
  onToggleFullscreen,
  onOpenSettings
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = () => {
    setIsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3500);
  };

  useEffect(() => {
    // Show HUD whenever slide changes
    resetHideTimer();
  }, [state.current_index]);

  useEffect(() => {
    const handleMouseMove = () => {
      resetHideTimer();
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const isPaused = !state.is_playing || state.is_paused_by_user || state.is_paused_by_interaction;

  const getStatusColor = () => {
    switch (state.status) {
      case 'ready':
        return 'bg-emerald-400 shadow-emerald-400/40';
      case 'loading':
        return 'bg-sky-400 animate-pulse shadow-sky-400/40';
      case 'error':
      case 'crashed':
        return 'bg-rose-400 shadow-rose-400/40';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-auto ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      onMouseEnter={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        setIsVisible(true);
      }}
      onMouseLeave={resetHideTimer}
    >
      <div className="flex items-center gap-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-md">
        {/* Status Dot & Slide Title */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-slate-700/60 max-w-xs">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${getStatusColor()}`} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-100 truncate">
              {state.current_slide?.name || 'Monitoring'}
            </span>
            <span className="text-[10px] text-slate-400">
              {state.total_slides > 0 ? `${state.current_index + 1} dari ${state.total_slides}` : 'Tidak ada slide'}
            </span>
          </div>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center justify-center px-2 py-1 bg-slate-800/90 rounded-lg text-xs font-mono text-slate-300 shrink-0">
          {isPaused ? (
            <span className="text-amber-400 font-medium">JEDA</span>
          ) : (
            <span>{state.remaining_seconds}s</span>
          )}
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            title="Slide Sebelumnya (Panah Kiri)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onTogglePlayPause}
            title={isPaused ? 'Lanjutkan (Spasi)' : 'Jeda (Spasi)'}
            className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm transition"
          >
            {isPaused ? (
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
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Auxiliary Controls */}
        <div className="flex items-center gap-1 pl-2 border-l border-slate-700/60">
          <button
            type="button"
            onClick={onReload}
            title="Muat Ulang Halaman (F5)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Keluar Layar Penuh (F11 / Esc)' : 'Layar Penuh (F11)'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
            title="Kembali ke Pengaturan (S)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 transition"
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
