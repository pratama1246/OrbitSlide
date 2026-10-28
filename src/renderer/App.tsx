import React, { useState, useEffect } from 'react';
import { SchedulerState } from '../types';
import { SettingsPage } from './components/SettingsPage';
import { FloatingHUD } from './components/FloatingHUD';
import { SlideErrorFallback } from './components/SlideErrorFallback';
import { PopupModal } from './components/PopupModal';
import { AppLanguage, detectDefaultLanguage } from './i18n';

export const App: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');
  const [language, setLanguage] = useState<AppLanguage>(() => detectDefaultLanguage());

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

  const resolveEffectiveTheme = (t: 'dark' | 'light' | 'system'): 'dark' | 'light' => {
    if (t === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  };

  const applyTheme = (t: 'dark' | 'light' | 'system') => {
    const effective = resolveEffectiveTheme(t);
    if (effective === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
    }
  };

  useEffect(() => {
    window.monitorAPI?.getSettings?.().then((st) => {
      if (st?.theme) {
        setTheme(st.theme);
        applyTheme(st.theme);
      }
      if (st?.language === 'en' || st?.language === 'id') {
        setLanguage(st.language);
        document.documentElement.lang = st.language;
      }
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setTheme((currentTheme) => {
        if (currentTheme === 'system') {
          applyTheme('system');
        }
        return currentTheme;
      });
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    let isInitial = true;
    const unsubScheduler = window.monitorAPI?.onSchedulerState?.((state) => {
      setSchedulerState(state);
      if (isInitial) {
        isInitial = false;
        if (state.is_playing) {
          setIsMonitoring(true);
        }
      }
    });

    const unsubFullscreen = window.monitorAPI?.onFullscreenChange?.((fullscreen) => {
      setIsFullscreen(fullscreen);
    });

    const unsubHud = window.monitorAPI?.onHudVisibilityChange?.((visible) => {
      setIsHudVisible(visible);
    });

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      unsubScheduler?.();
      unsubFullscreen?.();
      unsubHud?.();
    };
  }, []);

  const handleSetTheme = async (nextTheme: 'dark' | 'light' | 'system') => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      const current = await window.monitorAPI.getSettings();
      await window.monitorAPI.saveSettings({ ...current, theme: nextTheme });
    } catch (e) {
      console.error('Failed to save theme setting:', e);
    }
  };

  const handleSetLanguage = async (nextLang: AppLanguage) => {
    setLanguage(nextLang);
    document.documentElement.lang = nextLang;
    try {
      const current = await window.monitorAPI.getSettings();
      await window.monitorAPI.saveSettings({ ...current, language: nextLang });
    } catch (e) {
      console.error('Failed to save language setting:', e);
    }
  };

  const handleStartMonitoring = async () => {
    setIsHudVisible(true);
    setIsMonitoring(true);
    await window.monitorAPI.startMonitoring();
  };

  const handleOpenSettings = async () => {
    await window.monitorAPI.stopMonitoring();
    setIsMonitoring(false);
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
        language={language}
        onClose={handleClosePopup}
      />
    );
  }

  const currentSlideId = schedulerState.current_slide?.id;
  const currentRetryCount = currentSlideId
    ? schedulerState.slide_statuses[currentSlideId]?.retry_count || 0
    : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-transparent select-none">
      {/* Settings Page: stays mounted in DOM to prevent re-fetch flicker and layout jitter */}
      <div className={!isMonitoring && !schedulerState.is_popup_open ? 'block w-full h-full overflow-y-auto no-scrollbar' : 'hidden'}>
        <SettingsPage
          slideStatuses={schedulerState.slide_statuses}
          theme={theme}
          language={language}
          onSetTheme={handleSetTheme}
          onSetLanguage={handleSetLanguage}
          onStartMonitoring={handleStartMonitoring}
          onOpenPopup={handleOpenPopup}
        />
      </div>

      {/* Monitoring Mode UI: only rendered during monitoring mode */}
      {isMonitoring && !schedulerState.is_popup_open && (
        <>
          {(schedulerState.status === 'error' || schedulerState.status === 'crashed') && (
            <SlideErrorFallback
              slide={schedulerState.current_slide}
              errorMessage={schedulerState.error_message}
              retryCount={currentRetryCount}
              remainingSeconds={schedulerState.remaining_seconds}
              language={language}
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
            language={language}
            onPrev={handlePrev}
            onNext={handleNext}
            onJumpToSlide={handleJumpToSlide}
            onTogglePlayPause={handleTogglePlayPause}
            onReload={handleReload}
            onToggleFullscreen={handleToggleFullscreen}
            onOpenSettings={handleOpenSettings}
          />
        </>
      )}
    </div>
  );
};

export default App;
