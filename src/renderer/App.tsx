import React, { useState, useEffect } from 'react';
import { SchedulerState } from '../types';
import { SettingsPage } from './components/SettingsPage';
import { FloatingHUD } from './components/FloatingHUD';
import { SlideErrorFallback } from './components/SlideErrorFallback';
import { PopupModal } from './components/PopupModal';

export const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [schedulerState, setSchedulerState] = useState<SchedulerState>({
    current_index: 0,
    current_slide: null,
    active_slides: [],
    slide_statuses: {},
    is_playing: false,
    is_paused_by_user: false,
    is_paused_by_interaction: false,
    is_popup_open: false,
    popup_url: null,
    popup_profile: null,
    remaining_seconds: 0,
    total_slides: 0,
    status: 'idle'
  });

  const applyTheme = (t: 'dark' | 'light') => {
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  useEffect(() => {
    window.monitorAPI?.getSettings?.().then((st) => {
      if (st?.theme) {
        setTheme(st.theme);
        applyTheme(st.theme);
      }
    });

    const unsubScheduler = window.monitorAPI?.onSchedulerState?.((state) => {
      setSchedulerState(state);
      setIsMonitoring(state.is_playing);
    });

    const unsubFullscreen = window.monitorAPI?.onFullscreenChange?.((fullscreen) => {
      setIsFullscreen(fullscreen);
    });

    const unsubHud = window.monitorAPI?.onHudVisibilityChange?.((visible) => {
      setIsHudVisible(visible);
    });

    return () => {
      unsubScheduler?.();
      unsubFullscreen?.();
      unsubHud?.();
    };
  }, []);

  const handleToggleTheme = async () => {
    const nextTheme: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      const current = await window.monitorAPI.getSettings();
      await window.monitorAPI.saveSettings({ ...current, theme: nextTheme });
    } catch (e) {
      console.error('Failed to save theme setting:', e);
    }
  };

  const handleStartMonitoring = async () => {
    setIsMonitoring(true);
    setIsHudVisible(true);
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

  const handleJumpToSlide = async (index: number) => {
    await window.monitorAPI.jumpToSlide(index);
  };

  const handleReload = async () => {
    await window.monitorAPI.reloadCurrentSlide();
  };

  const handleToggleFullscreen = async () => {
    const nextState = await window.monitorAPI.toggleFullscreen();
    setIsFullscreen(nextState);
  };

  const handleOpenPopup = async (url: string, profile: string) => {
    await window.monitorAPI.openPopup(url, profile);
  };

  const handleClosePopup = async () => {
    await window.monitorAPI.closePopup();
  };

  if (schedulerState.is_popup_open) {
    return (
      <PopupModal
        url={schedulerState.popup_url}
        profile={schedulerState.popup_profile}
        isMonitoring={isMonitoring}
        onClose={handleClosePopup}
      />
    );
  }

  if (!isMonitoring) {
    return (
      <SettingsPage
        slideStatuses={schedulerState.slide_statuses}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onStartMonitoring={handleStartMonitoring}
        onOpenPopup={handleOpenPopup}
      />
    );
  }

  const currentSlideId = schedulerState.current_slide?.id;
  const currentRetryCount = currentSlideId
    ? schedulerState.slide_statuses[currentSlideId]?.retry_count || 0
    : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent select-none">
      {(schedulerState.status === 'error' || schedulerState.status === 'crashed') && (
        <SlideErrorFallback
          slide={schedulerState.current_slide}
          errorMessage={schedulerState.error_message}
          retryCount={currentRetryCount}
          remainingSeconds={schedulerState.remaining_seconds}
          onReload={handleReload}
          onNext={handleNext}
        />
      )}

      <FloatingHUD
        state={schedulerState}
        isVisible={
          isHudVisible ||
          schedulerState.status === 'error' ||
          schedulerState.status === 'crashed'
        }
        isFullscreen={isFullscreen}
        onPrev={handlePrev}
        onNext={handleNext}
        onJumpToSlide={handleJumpToSlide}
        onTogglePlayPause={handleTogglePlayPause}
        onReload={handleReload}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenSettings={handleOpenSettings}
      />
    </div>
  );
};

export default App;
