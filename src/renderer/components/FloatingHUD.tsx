import React, { useState, useEffect, useMemo } from 'react';
import { SchedulerState, SlideLoadStatus } from '../../types';
import { Logo } from './Logo';
import { AppLanguage, getTranslations } from '../i18n';

interface FloatingHUDProps {
  state: SchedulerState;
  isVisible: boolean;
  isFullscreen: boolean;
  language?: AppLanguage;
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
  language = 'id',
  onPrev,
  onNext,
  onJumpToSlide,
  onTogglePlayPause,
  onReload,
  onToggleFullscreen,
  onOpenSettings
}) => {
  const t = getTranslations(language);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectableSlides = useMemo(() => {
    return state.active_slides
      .map((slide, originalIndex) => ({ slide, originalIndex }))
      .filter(({ slide }) => slide.id !== 'system-standby');
  }, [state.active_slides]);

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    const active = [...state.active_slides];
    const [moved] = active.splice(sourceIndex, 1);
    active.splice(targetIndex, 0, moved);

    try {
      const allWebsites = await window.monitorAPI.getWebsites();
      const inactive = allWebsites.filter((w) => !w.is_active);
      const orderedIds = [...active.map((s) => s.id), ...inactive.map((s) => s.id)];
      await window.monitorAPI.reorderWebsites(orderedIds);
    } catch (err) {
      console.error('Failed to reorder slides from HUD:', err);
    }
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
        return 'bg-black-forest-500';
      case 'loading':
        return 'bg-light-blue-400';
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
      <div
        onMouseEnter={handleMouseEnter}
        className="fixed top-0 left-0 right-0 h-2.5 bg-transparent cursor-pointer z-50 pointer-events-auto"
        title={t.hudWakeTooltip}
      />

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
          <div className="w-[380px] max-w-[calc(100vw-24px)] overflow-hidden flex items-center justify-between gap-1.5 bg-white/95 dark:bg-light-blue-900/95 backdrop-blur-md border border-slate-200/90 dark:border-light-blue-800 rounded-full px-2.5 py-1.5 text-slate-700 dark:text-slate-100">
            <button
              type="button"
              onClick={toggleMenu}
              title={state.current_slide ? `${state.current_slide.name} (${t.hudClickToSelect})` : t.hudSelectSlide}
              className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-light-blue-800/80 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
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
                  title={state.current_slide?.name || 'OrbitSlide'}
                  className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate block flex-1 text-left"
                >
                  {state.current_slide?.name || 'OrbitSlide'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-light-blue-300 shrink-0">
                  {state.total_slides > 0 ? `${state.current_index + 1}/${state.total_slides}` : '0/0'}
                </span>
              </div>
              <svg
                className={`w-3 h-3 text-slate-400 dark:text-light-blue-300 shrink-0 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-light-blue-800 shrink-0" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrev}
                title={t.hudPrevTooltip}
                className="p-1 text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400 active:scale-90"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onTogglePlayPause}
                title={isManuallyPaused ? t.hudPlayTooltip : t.hudPauseTooltip}
                className="w-6 h-6 rounded-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white flex items-center justify-center transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
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
                title={t.hudNextTooltip}
                className="p-1 text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400 active:scale-90"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-200 dark:bg-light-blue-800 shrink-0" />

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onReload}
                title={t.hudReloadTooltip}
                className="p-1.5 rounded-full text-slate-500 dark:text-light-blue-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-light-blue-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? t.hudExitFullscreenTooltip : t.hudEnterFullscreenTooltip}
                className="p-1.5 rounded-full text-slate-500 dark:text-light-blue-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-light-blue-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
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
                title={t.hudSettingsTooltip}
                className="p-1.5 rounded-full text-slate-500 dark:text-light-blue-300 hover:text-light-blue-600 dark:hover:text-orange-400 hover:bg-light-blue-50 dark:hover:bg-light-blue-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Slide Selector Popover (Opens Downward) */}
          {isMenuOpen && selectableSlides.length > 0 && (
            <div className="w-[380px] max-w-[calc(100vw-24px)] mt-2 bg-white dark:bg-light-blue-900 border border-slate-200 dark:border-light-blue-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-light-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Logo size={18} variant="mark-gradient" className="shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {t.hudSelectSlide} · {t.hudActiveCount(selectableSlides.length)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 dark:text-light-blue-300 hidden sm:inline">
                    {t.hudDragHint}
                  </span>
                  <button
                    type="button"
                    onClick={toggleMenu}
                    className="text-slate-400 hover:text-slate-700 dark:text-light-blue-300 dark:hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-light-blue-400 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-light-blue-800/60">
                {selectableSlides.map(({ slide, originalIndex }, displayIdx) => {
                  const isCurrent = originalIndex === state.current_index;
                  const slideSt = state.slide_statuses[slide.id]?.status || 'idle';
                  const isDragging = draggedIndex === originalIndex;
                  const isDragOver = dragOverIndex === originalIndex && draggedIndex !== originalIndex;

                  return (
                    <div
                      key={slide.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, originalIndex)}
                      onDragOver={(e) => handleDragOver(e, originalIndex)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, originalIndex)}
                      className={`group w-full px-2.5 py-2 flex items-center justify-between gap-2 transition select-none ${
                        isDragging
                          ? 'opacity-30 scale-[0.99] border-dashed border-2 border-light-blue-400 bg-light-blue-50/40 dark:bg-light-blue-950/40'
                          : isDragOver
                          ? 'border-t-2 border-t-light-blue-500 dark:border-t-light-blue-400 bg-light-blue-50/40 dark:bg-light-blue-800/70'
                          : isCurrent
                          ? 'bg-light-blue-50 text-light-blue-950 dark:bg-light-blue-950/75 dark:text-white'
                          : 'hover:bg-slate-50 dark:hover:bg-light-blue-800/50 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-500 dark:text-light-blue-600 dark:group-hover:text-light-blue-300 hover:!text-light-blue-600 dark:hover:!text-light-blue-300 p-0.5 rounded transition shrink-0"
                        title={t.dragToReorder}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="8.5" cy="6" r="1.5" />
                          <circle cx="15.5" cy="6" r="1.5" />
                          <circle cx="8.5" cy="12" r="1.5" />
                          <circle cx="15.5" cy="12" r="1.5" />
                          <circle cx="8.5" cy="18" r="1.5" />
                          <circle cx="15.5" cy="18" r="1.5" />
                        </svg>
                      </div>

                      <div
                        onClick={() => handleSelectSlide(originalIndex)}
                        className="flex-1 min-w-0 flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-light-blue-300 w-5 shrink-0">
                            #{displayIdx + 1}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(slideSt)}`} />
                          <div className="truncate">
                            <div className="text-xs font-semibold truncate leading-tight">{slide.name}</div>
                            <div className="text-[10px] text-slate-400 dark:text-light-blue-300 truncate leading-tight">
                              {slide.url}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-semibold text-light-blue-700 bg-light-blue-100 dark:text-light-blue-200 dark:bg-light-blue-800 px-1.5 py-0.5 rounded">
                              {t.statusActive}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
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
