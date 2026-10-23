import React, { useState, useEffect } from 'react';
import { SchedulerState } from '../types';
import { SettingsPage } from './components/SettingsPage';
import { FloatingHUD } from './components/FloatingHUD';
import { SlideErrorFallback } from './components/SlideErrorFallback';
import { PopupModal } from './components/PopupModal';

export const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [schedulerState, setSchedulerState] = useState<SchedulerState>({
    current_index: 0,
    current_slide: null,
    is_playing: false,
    is_paused_by_user: false,
    is_paused_by_interaction: false,
    is_popup_open: false,
    remaining_seconds: 0,
    total_slides: 0,
    status: 'idle'
  });

  useEffect(() => {
    const unsubScheduler = window.monitorAPI?.onSchedulerState?.((state) => {
      setSchedulerState(state);
      if (state.is_playing) {
        setIsMonitoring(true);
      }
    });

    const unsubFullscreen = window.monitorAPI?.onFullscreenChange?.((fullscreen) => {
      setIsFullscreen(fullscreen);
    });

    return () => {
      unsubScheduler?.();
      unsubFullscreen?.();
    };
  }, []);

  const handleStartMonitoring = async () => {
    setIsMonitoring(true);
    await window.monitorAPI.startMonitoring();
  };

  const handleOpenSettings = async () => {
    setIsMonitoring(false);
    await window.monitorAPI.stopMonitoring();
  };

  const handleTogglePlayPause = async () => {
    await window.monitorAPI.togglePlayPause();
  };

  const handleNext = async () => {
    await window.monitorAPI.nextSlide();
  };

  const handlePrev = async () => {
    await window.monitorAPI.prevSlide();
  };

  const handleReload = async () => {
    await window.monitorAPI.reloadCurrentSlide();
  };

  const handleToggleFullscreen = async () => {
    const nextState = await window.monitorAPI.toggleFullscreen();
    setIsFullscreen(nextState);
  };

  const handleClosePopup = async () => {
    await window.monitorAPI.closePopup();
  };

  if (!isMonitoring) {
    return <SettingsPage onStartMonitoring={handleStartMonitoring} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent select-none">
      {/* Top Banner when in-app popup view is open */}
      {schedulerState.is_popup_open && (
        <PopupModal onClose={handleClosePopup} />
      )}

      {/* Error Fallback Card if current website is down or crashed */}
      {(schedulerState.status === 'error' || schedulerState.status === 'crashed') && (
        <SlideErrorFallback
          slide={schedulerState.current_slide}
          errorMessage={schedulerState.error_message}
          remainingSeconds={schedulerState.remaining_seconds}
          onReload={handleReload}
          onNext={handleNext}
        />
      )}

      {/* Floating Auto-hide HUD at the bottom */}
      <FloatingHUD
        state={schedulerState}
        isFullscreen={isFullscreen}
        onPrev={handlePrev}
        onNext={handleNext}
        onTogglePlayPause={handleTogglePlayPause}
        onReload={handleReload}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenSettings={handleOpenSettings}
      />
    </div>
  );
};

export default App;
