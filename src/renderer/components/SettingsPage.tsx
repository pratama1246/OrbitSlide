import React, { useState, useEffect, useMemo } from 'react';
import { WebsiteSlide, AppSettings, SlideRuntimeStatus, StandbyWallpaperItem, AppSystemInfo } from '../../types';
import { Logo } from './Logo';
import { AppLanguage, getTranslations } from '../i18n';

interface SettingsPageProps {
  slideStatuses: Record<string, SlideRuntimeStatus>;
  theme: 'dark' | 'light' | 'system';
  language: AppLanguage;
  onSetTheme: (theme: 'dark' | 'light' | 'system') => void;
  onSetLanguage: (lang: AppLanguage) => Promise<void> | void;
  onStartMonitoring: () => void;
  onOpenPopup: (url: string, profile: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  slideStatuses,
  theme,
  language,
  onSetTheme,
  onSetLanguage,
  onStartMonitoring,
  onOpenPopup
}) => {
  const t = getTranslations(language);

  const [websites, setWebsites] = useState<WebsiteSlide[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    auto_start_monitoring: true,
    idle_timeout_seconds: 30,
    default_duration: 15,
    start_fullscreen: false,
    theme: 'system',
    slide_animation: true,
    launch_on_startup: false,
    ignore_certificate_errors: true,
    language
  });

  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<WebsiteSlide | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'license'>('terms');
  const [appInfo, setAppInfo] = useState<AppSystemInfo | null>(null);
  const [copiedInfoNotice, setCopiedInfoNotice] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'preferences' | 'kiosk_session'>('preferences');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearProfile, setConfirmClearProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    duration: 15,
    session_profile: 'default',
    keep_alive: true,
    reload_interval: 0,
    is_active: true,
    standby_preset: 'solid' as 'solid' | 'custom',
    standby_color: '#09171b'
  });

  const [standbyWallpapers, setStandbyWallpapers] = useState<StandbyWallpaperItem[]>([]);

  const [customClearProfile, setCustomClearProfile] = useState('');
  const [sessionClearNotice, setSessionClearNotice] = useState<string | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    loadData(websites.length === 0);
  }, []);

  const loadData = async (showLoading = websites.length === 0) => {
    if (showLoading) setIsLoading(true);
    try {
      if (!window.monitorAPI) {
        throw new Error('Preload bridge not found.');
      }
      const [loadedWebsites, loadedSettings, loadedWallpapers] = await Promise.all([
        window.monitorAPI.getWebsites(),
        window.monitorAPI.getSettings(),
        window.monitorAPI.getStandbyWallpapers ? window.monitorAPI.getStandbyWallpapers() : Promise.resolve([])
      ]);
      setWebsites(loadedWebsites);
      setSettings(loadedSettings);
      setStandbyWallpapers(loadedWallpapers || []);
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageSwitch = async (nextLang: AppLanguage) => {
    setSettings((prev) => ({ ...prev, language: nextLang }));
    await onSetLanguage(nextLang);
    await loadData(false);
  };

  const availableProfiles = useMemo(() => {
    const map = new Map<string, number>();
    map.set('default', 0);
    for (const w of websites) {
      const prof = w.session_profile || 'default';
      map.set(prof, (map.get(prof) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [websites]);

  const normalizeAndValidateUrl = (rawUrl: string): { valid: boolean; url: string; error?: string } => {
    let normalized = rawUrl.trim();
    if (!normalized) {
      return { valid: false, url: '', error: t.errUrlRequired };
    }

    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, url: normalized, error: t.errUrlProtocol };
      }
      if (!parsed.hostname) {
        return { valid: false, url: normalized, error: t.errUrlHost };
      }
      return { valid: true, url: normalized };
    } catch {
      return {
        valid: false,
        url: normalized,
        error: t.errUrlFormat
      };
    }
  };

  const parseStandbyConfig = (rawUrl: string): { preset: 'solid' | 'custom'; color: string } => {
    try {
      const parsed = new URL(rawUrl);
      const p = parsed.searchParams.get('preset');
      const c = parsed.searchParams.get('color');
      const color = c && /^#?[0-9a-fA-F]{6}$/.test(decodeURIComponent(c))
        ? (decodeURIComponent(c).startsWith('#') ? decodeURIComponent(c) : `#${decodeURIComponent(c)}`)
        : '#09171b';
      if (p === 'custom') {
        return { preset: 'custom', color };
      }
      return { preset: 'solid', color };
    } catch {}
    return { preset: 'solid', color: '#09171b' };
  };

  const buildStandbyUrl = (preset: 'solid' | 'custom', color: string = '#09171b'): string => {
    const cleanColor = encodeURIComponent(color.startsWith('#') ? color : `#${color}`);
    return `local://standby?preset=${preset}&color=${cleanColor}&v=${Date.now()}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatWallpaperDisplayName = (fileName: string): string => {
    return fileName.replace(/^\d+_\d+_/, '');
  };

  const getStandbyDescription = (rawUrl: string): string => {
    const cfg = parseStandbyConfig(rawUrl);
    if (cfg.preset === 'custom') {
      return t.standbyCustomCount(standbyWallpapers.length);
    }
    return `${t.standbyPresetPrefix}: ${t.presetSolid} (${cfg.color.toUpperCase()})`;
  };

  const handleUploadWallpapers = async () => {
    if (standbyWallpapers.length >= 3) return;
    try {
      const updated = await window.monitorAPI.uploadStandbyWallpapers();
      setStandbyWallpapers(updated);
      setFormData((prev) => ({ ...prev, standby_preset: 'custom' }));
      setFormError(null);
    } catch (err) {
      console.error('Failed to upload wallpaper:', err);
    }
  };

  const handleDeleteWallpaper = async (fileName: string) => {
    try {
      const updated = await window.monitorAPI.deleteStandbyWallpaper(fileName);
      setStandbyWallpapers(updated);
    } catch (err) {
      console.error('Failed to delete wallpaper:', err);
    }
  };

  const handleClearAllWallpapers = async () => {
    if (standbyWallpapers.length === 0) return;
    try {
      if (window.monitorAPI.clearStandbyWallpapers) {
        const updated = await window.monitorAPI.clearStandbyWallpapers();
        setStandbyWallpapers(updated || []);
      }
    } catch (err) {
      console.error('Failed to clear all wallpapers:', err);
    }
  };

  const totalWallpaperBytes = useMemo(() => {
    return standbyWallpapers.reduce((sum, item) => sum + (item.sizeBytes || 0), 0);
  }, [standbyWallpapers]);

  const handleOpenAddForm = () => {
    setEditingSlide(null);
    setFormData({
      name: '',
      url: '',
      duration: settings.default_duration || 15,
      session_profile: 'default',
      keep_alive: true,
      reload_interval: 0,
      is_active: true,
      standby_preset: 'solid',
      standby_color: '#09171b'
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (slide: WebsiteSlide) => {
    setEditingSlide(slide);
    const standbyCfg = parseStandbyConfig(slide.url);
    setFormData({
      name: slide.name,
      url: slide.url,
      duration: slide.duration,
      session_profile: slide.session_profile || 'default',
      keep_alive: true,
      reload_interval: typeof slide.reload_interval === 'number' ? slide.reload_interval : 0,
      is_active: slide.is_active,
      standby_preset: standbyCfg.preset,
      standby_color: standbyCfg.color
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError(t.errNameRequired);
      return;
    }

    const isStandby = editingSlide?.id === 'system-standby';
    let targetUrl = '';

    if (isStandby) {
      if (formData.standby_preset === 'custom' && standbyWallpapers.length === 0) {
        setFormError(t.errCustomWallpaperEmpty);
        return;
      }
      targetUrl = buildStandbyUrl(formData.standby_preset, formData.standby_color);
    } else {
      const urlCheck = normalizeAndValidateUrl(formData.url);
      if (!urlCheck.valid) {
        setFormError(urlCheck.error || t.errUrlFormat);
        return;
      }
      targetUrl = urlCheck.url;
    }

    const slideToSave = {
      id: editingSlide ? editingSlide.id : `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      url: targetUrl,
      duration: settings.default_duration || 15,
      sort_order: editingSlide ? editingSlide.sort_order : websites.length,
      is_active: editingSlide ? editingSlide.is_active : true,
      keep_alive: true,
      reload_interval: isStandby ? 0 : formData.reload_interval,
      session_profile: isStandby ? 'default' : (editingSlide?.session_profile || 'default')
    };

    try {
      await window.monitorAPI.saveWebsite(slideToSave);
      setIsFormOpen(false);
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setFormError(`${t.errSaveFailed}: ${msg}`);
    }
  };

  const handleTestUrlFromModal = () => {
    if (editingSlide?.id === 'system-standby') {
      const previewUrl = buildStandbyUrl(formData.standby_preset, formData.standby_color);
      onOpenPopup(previewUrl, 'default');
      return;
    }
    const urlCheck = normalizeAndValidateUrl(formData.url);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error || t.errInvalidTestUrl);
      return;
    }
    onOpenPopup(urlCheck.url, formData.session_profile.trim() || 'default');
  };

  const handleDeleteSlide = async (id: string) => {
    await window.monitorAPI.deleteWebsite(id);
    setConfirmDeleteId(null);
    await loadData();
  };

  const reorderSlideIndices = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= websites.length || fromIdx === toIdx) return;
    const newOrder = [...websites];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setWebsites(newOrder);
    await window.monitorAPI.reorderWebsites(newOrder.map((item) => item.id));
    await loadData(false);
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    reorderSlideIndices(index, direction === 'up' ? index - 1 : index + 1);
  };

  const handleOpenAbout = async () => {
    setIsAboutModalOpen(true);
    if (!appInfo && window.monitorAPI?.getAppInfo) {
      try {
        const info = await window.monitorAPI.getAppInfo();
        setAppInfo(info);
      } catch (err) {
        console.error('Failed to get app info:', err);
      }
    }
  };

  const handleOpenLegal = (tab: 'terms' | 'privacy' | 'license') => {
    setLegalTab(tab);
    setIsLegalModalOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
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

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (sourceIndex !== null) {
      reorderSlideIndices(sourceIndex, targetIndex);
    }
  };

  const handleToggleActive = async (slide: WebsiteSlide) => {
    await window.monitorAPI.saveWebsite({
      ...slide,
      is_active: !slide.is_active
    });
    await loadData();
  };

  const handleSettingChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value, language };
    setSettings(updated);
    await window.monitorAPI.saveSettings(updated);
    if (key === 'default_duration') {
      await loadData();
    }
  };

  const handleClearSession = async (profileName: string) => {
    const target = profileName.trim() || 'default';
    await window.monitorAPI.clearSessionProfile(target);
    setConfirmClearProfile(null);
    setCustomClearProfile('');
    setSessionClearNotice(t.sessionClearedNotice(target));
    setTimeout(() => setSessionClearNotice(null), 4000);
  };

  const getStatusBadge = (slideId: string) => {
    const st = slideStatuses[slideId];
    if (!st || st.status === 'idle') {
      return null;
    }
    if (st.status === 'ready') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-black-forest-50 text-black-forest-800 border border-black-forest-300 dark:bg-black-forest-950/80 dark:border-black-forest-500/40 dark:text-black-forest-300">
          {t.statusConnected}
        </span>
      );
    }
    if (st.status === 'loading') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-light-blue-50 text-light-blue-700 border border-light-blue-300 dark:bg-light-blue-950/80 dark:border-light-blue-500/40 dark:text-light-blue-300">
          {t.statusLoading}
        </span>
      );
    }
    return (
      <span
        className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/80 dark:border-rose-500/40 dark:text-rose-300"
        title={st.error_message}
      >
        {t.statusFailed}
      </span>
    );
  };

  const activeWebsitesCount = websites.filter((w) => w.is_active).length;

  return (
    <div className="h-screen bg-slate-100 text-slate-800 dark:bg-light-blue-950 dark:text-slate-100 flex flex-col overflow-hidden">
      <header className="h-16 border-b border-slate-200 bg-white dark:border-light-blue-800 dark:bg-light-blue-900 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Logo size={34} variant="mark-gradient" className="shrink-0" />
          <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">{t.appName}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Language Toggle Pill */}
          <div className="h-9 flex items-center p-1 rounded-xl border border-slate-200 dark:border-light-blue-800 bg-slate-100 dark:bg-light-blue-950 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleLanguageSwitch('id')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                language === 'id'
                  ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-light-blue-300 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Bahasa Indonesia"
            >
              ID
            </button>
            <button
              type="button"
              onClick={() => handleLanguageSwitch('en')}
              className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                language === 'en'
                  ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-light-blue-300 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="English"
            >
              EN
            </button>
          </div>

          {/* Keyboard Shortcuts Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            title={t.shortcutsTooltip}
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-light-blue-800 bg-white dark:bg-light-blue-800/70 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-light-blue-700 transition cursor-pointer text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-light-blue-400 shadow-2xs"
          >
            <svg className="w-4 h-4 text-slate-500 dark:text-light-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2.5" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 15h8" />
            </svg>
            <span>{t.shortcuts}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddForm}
            className="h-9 flex items-center gap-1.5 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-light-blue-800/70 dark:hover:bg-light-blue-700 dark:text-slate-100 dark:border-light-blue-800 border text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-light-blue-400 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>{t.addWebsite}</span>
          </button>

          <button
            type="button"
            onClick={onStartMonitoring}
            disabled={activeWebsitesCount === 0}
            className={`h-9 flex items-center gap-2 px-4 rounded-xl font-semibold text-xs shadow-xs transition focus:outline-none focus:ring-2 focus:ring-orange-400 ${
              activeWebsitesCount > 0
                ? 'bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 dark:bg-light-blue-900 dark:text-light-blue-700 cursor-not-allowed'
            }`}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>{t.startMonitoring}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0 overflow-hidden">
        {/* Left Column: Website List (2 Cols) */}
        <section className="lg:col-span-2 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="flex items-center justify-between shrink-0 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.websiteListTitle}</h2>
              <p className="text-xs text-slate-500 dark:text-light-blue-300">
                {t.websiteListSub}
              </p>
            </div>
          </div>

          {isLoading && websites.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-light-blue-300 text-sm">{t.loadingConfig}</div>
          ) : websites.length === 0 ? (
            <div className="p-10 border border-dashed border-slate-300 dark:border-light-blue-800 rounded-2xl text-center bg-white dark:bg-light-blue-900/50 shadow-xs flex flex-col items-center">
              <Logo size={52} variant="mark-gradient" className="mb-3" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{t.emptyTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-light-blue-300 max-w-sm mb-4">
                {t.emptySub}
              </p>
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="px-4 py-2 rounded-xl bg-light-blue-600 hover:bg-light-blue-500 text-white text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-light-blue-400"
              >
                {t.addFirstWebsite}
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 min-h-0">
              {websites.map((slide, index) => {
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index && draggedIndex !== index;

                return (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isDragging
                        ? 'opacity-30 scale-[0.99] border-dashed border-light-blue-400 bg-light-blue-50/40 dark:bg-light-blue-900/40'
                        : isDragOver
                        ? 'border-t-2 border-t-light-blue-500 dark:border-t-light-blue-400 bg-light-blue-50/30 dark:bg-light-blue-900/90 shadow-md'
                        : slide.is_active
                        ? 'bg-white border-slate-200 dark:bg-light-blue-900/90 dark:border-light-blue-800 hover:border-slate-300 dark:hover:border-light-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 dark:bg-light-blue-950/60 dark:border-light-blue-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-light-blue-600 dark:text-light-blue-400 dark:hover:text-light-blue-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-light-blue-800 transition select-none"
                        title={t.dragToReorder}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="8.5" cy="6" r="1.5" />
                          <circle cx="15.5" cy="6" r="1.5" />
                          <circle cx="8.5" cy="12" r="1.5" />
                          <circle cx="15.5" cy="12" r="1.5" />
                          <circle cx="8.5" cy="18" r="1.5" />
                          <circle cx="15.5" cy="18" r="1.5" />
                        </svg>
                      </div>

                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-light-blue-50 text-light-blue-700 border border-light-blue-200/80 dark:bg-light-blue-950/80 dark:text-light-blue-300 dark:border-light-blue-700 font-mono">
                        #{index + 1}
                      </span>

                      <div className="flex flex-col gap-0.5 ml-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(index, 'up')}
                          disabled={index === 0}
                          title={t.moveUp}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-light-blue-800 disabled:opacity-20 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(index, 'down')}
                          disabled={index === websites.length - 1}
                          title={t.moveDown}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-light-blue-800 disabled:opacity-20 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {slide.name}
                        </h3>
                        {slide.id === 'system-standby' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-light-blue-50 text-light-blue-700 border border-light-blue-200 dark:bg-light-blue-950/80 dark:text-light-blue-300 dark:border-light-blue-700">
                            {t.systemBuiltIn}
                          </span>
                        )}
                        {getStatusBadge(slide.id)}
                        {slide.id !== 'system-standby' && (
                          (!slide.reload_interval || slide.reload_interval === 0) ? (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                              title={t.reloadBadgeStandbyTitle}
                            >
                              Live
                            </span>
                          ) : slide.reload_interval === -1 ? (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800"
                              title={t.reloadBadgeEveryTurnTitle}
                            >
                              🔄 {t.reloadBadgeEveryTurn}
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800"
                              title={t.reloadBadgeIntervalTitle(slide.reload_interval)}
                            >
                              ⏱️ {slide.reload_interval}m
                            </span>
                          )
                        )}
                        {slide.id !== 'system-standby' && slide.session_profile && slide.session_profile !== 'default' && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 dark:bg-light-blue-800 dark:text-light-blue-200">
                            {t.sessionBadge}: {slide.session_profile}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-light-blue-300 truncate" title={slide.url}>
                        {slide.id === 'system-standby' ? getStandbyDescription(slide.url) : slide.url}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenPopup(slide.url, slide.session_profile)}
                        title={slide.id === 'system-standby' ? t.previewTooltip : t.testLoginTooltip}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-light-blue-800 dark:hover:bg-light-blue-700 dark:text-slate-100 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-light-blue-700 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
                      >
                        {slide.id === 'system-standby' ? t.preview : t.testLogin}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(slide)}
                        title={slide.is_active ? t.disableSlide : t.enableSlide}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400 ${
                          slide.is_active ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-xs ${
                            slide.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(slide)}
                        title={t.edit}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-light-blue-300 dark:hover:text-white dark:hover:bg-light-blue-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-light-blue-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      {slide.id === 'system-standby' ? (
                        <div
                          title={t.systemBuiltInTooltip}
                          className="p-1.5 rounded-lg text-slate-300 dark:text-light-blue-700 cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      ) : confirmDeleteId === slide.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSlide(slide.id)}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            {t.delete}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded bg-slate-200 dark:bg-light-blue-800 text-slate-700 dark:text-slate-200 text-[11px] cursor-pointer"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(slide.id)}
                          title={t.deleteSlideTooltip}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:text-light-blue-300 dark:hover:text-rose-400 dark:hover:bg-light-blue-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Tabbed Settings Card (Preferensi | Kiosk & Sesi) */}
        <aside className="flex flex-col gap-4 overflow-y-auto no-scrollbar min-h-0">
          <div className="bg-white border-slate-200 dark:bg-light-blue-900 dark:border-light-blue-800 border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            {/* Segmented Tab Bar */}
            <div className="flex p-1 bg-slate-100 dark:bg-light-blue-950 rounded-xl border border-slate-200/60 dark:border-light-blue-800">
              <button
                type="button"
                onClick={() => setSettingsTab('preferences')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  settingsTab === 'preferences'
                    ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white'
                }`}
              >
                {t.tabPreferences}
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('kiosk_session')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  settingsTab === 'kiosk_session'
                    ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white'
                }`}
              >
                {t.tabSessionCookie}
              </button>
            </div>

            {/* Tab 1: Preferensi Monitoring */}
            {settingsTab === 'preferences' && (
              <div className="flex flex-col gap-4">
                {/* 1. Duration & Idle inputs at the top */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="default_duration" className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t.slideDurationLabel}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="default_duration"
                        type="number"
                        min="3"
                        max="3600"
                        value={settings.default_duration}
                        onChange={(e) => handleSettingChange('default_duration', parseInt(e.target.value, 10) || 15)}
                        className="w-full bg-slate-50 dark:bg-light-blue-950 border border-slate-200 dark:border-light-blue-800 rounded-xl px-3 py-2 pr-12 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-light-blue-500 focus:ring-1 focus:ring-light-blue-500"
                      />
                      <span className="absolute right-3 text-[11px] text-slate-400 dark:text-light-blue-300 pointer-events-none">{t.secondsShort}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-light-blue-300">{t.defaultDisplayTime}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="idle_timeout" className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {t.resumeRotationLabel}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="idle_timeout"
                        type="number"
                        min="5"
                        max="600"
                        value={settings.idle_timeout_seconds}
                        onChange={(e) => handleSettingChange('idle_timeout_seconds', parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-slate-50 dark:bg-light-blue-950 border border-slate-200 dark:border-light-blue-800 rounded-xl px-3 py-2 pr-12 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-light-blue-500 focus:ring-1 focus:ring-light-blue-500"
                      />
                      <span className="absolute right-3 text-[11px] text-slate-400 dark:text-light-blue-300 pointer-events-none">{t.secondsShort}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-light-blue-300">{t.afterCursorIdle}</span>
                  </div>
                </div>

                {/* 2. Slideshow & Playback Toggles */}
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-light-blue-800/80 border-t border-b border-slate-100 dark:border-light-blue-800/80">
                  {/* Auto-start */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.autoStartTitle}</div>
                      <div className="text-[11px] text-slate-500 dark:text-light-blue-300">{t.autoStartDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.auto_start_monitoring}
                      onClick={() => handleSettingChange('auto_start_monitoring', !settings.auto_start_monitoring)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-light-blue-400 focus:ring-offset-2 dark:focus:ring-offset-light-blue-900 ${
                        settings.auto_start_monitoring ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.auto_start_monitoring ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Start fullscreen */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.fullscreenTitle}</div>
                      <div className="text-[11px] text-slate-500 dark:text-light-blue-300">{t.fullscreenDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.start_fullscreen}
                      onClick={() => handleSettingChange('start_fullscreen', !settings.start_fullscreen)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-light-blue-400 focus:ring-offset-2 dark:focus:ring-offset-light-blue-900 ${
                        settings.start_fullscreen ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.start_fullscreen ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Slide animation */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.slideAnimTitle}</div>
                      <div className="text-[11px] text-slate-500 dark:text-light-blue-300">{t.slideAnimDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.slide_animation !== false}
                      onClick={() => handleSettingChange('slide_animation', settings.slide_animation === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-light-blue-400 focus:ring-offset-2 dark:focus:ring-offset-light-blue-900 ${
                        settings.slide_animation !== false ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.slide_animation !== false ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Theme Selector at the bottom */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.themeLabel}</span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-light-blue-950 rounded-xl border border-slate-200/60 dark:border-light-blue-800">
                    <button
                      type="button"
                      onClick={() => onSetTheme('light')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white font-bold shadow-xs'
                          : 'text-slate-500 dark:text-light-blue-300 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{t.themeLight}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTheme('dark')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white font-bold shadow-xs'
                          : 'text-slate-500 dark:text-light-blue-300 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-light-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span>{t.themeDark}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTheme('system')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'system'
                          ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white font-bold shadow-xs'
                          : 'text-slate-500 dark:text-light-blue-300 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-light-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{t.themeSystem}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Sistem & Sesi */}
            {settingsTab === 'kiosk_session' && (
              <div className="flex flex-col gap-4">
                {/* 1. Technical & System Toggles */}
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-light-blue-800/80 border-b border-slate-100 dark:border-light-blue-800/80 pb-1">
                  {/* Windows Auto-Start */}
                  <div className="flex items-center justify-between gap-3 py-2.5 pt-0.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.winAutoStartTitle}</div>
                      <div className="text-[11px] text-slate-500 dark:text-light-blue-300">{t.winAutoStartDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!settings.launch_on_startup}
                      onClick={() => handleSettingChange('launch_on_startup', !settings.launch_on_startup)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-light-blue-400 focus:ring-offset-2 dark:focus:ring-offset-light-blue-900 ${
                        settings.launch_on_startup ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.launch_on_startup ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Ignore SSL Certificate Errors */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.ignoreSslTitle}</div>
                      <div className="text-[11px] text-slate-500 dark:text-light-blue-300">{t.ignoreSslDesc}</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.ignore_certificate_errors !== false}
                      onClick={() => handleSettingChange('ignore_certificate_errors', settings.ignore_certificate_errors === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-light-blue-400 focus:ring-offset-2 dark:focus:ring-offset-light-blue-900 ${
                        settings.ignore_certificate_errors !== false ? 'bg-light-blue-500' : 'bg-slate-300 dark:bg-light-blue-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.ignore_certificate_errors !== false ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. Session Profile Management */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.sessionProfileTitle}</span>
                    <span className="text-[10px] text-slate-400 dark:text-light-blue-300">{t.profileCount(availableProfiles.length)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-light-blue-300 leading-relaxed">
                    {t.sessionProfileDesc}
                  </p>

                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {availableProfiles.map(([profName, count]) => (
                      <div
                        key={profName}
                        className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/70 border border-slate-200/80 dark:border-light-blue-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                            {profName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-light-blue-300">
                            {t.slideCount(count)}
                          </span>
                        </div>

                        {confirmClearProfile === profName ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleClearSession(profName)}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition cursor-pointer"
                            >
                              {t.confirmReset}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearProfile(null)}
                              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-light-blue-800 text-slate-700 dark:text-slate-200 text-[10px] transition cursor-pointer"
                            >
                              {t.cancel}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearProfile(profName)}
                            className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-light-blue-300 dark:hover:text-rose-400 font-medium transition cursor-pointer"
                          >
                            {t.resetCookie}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={customClearProfile}
                      onChange={(e) => setCustomClearProfile(e.target.value)}
                      placeholder={t.clearOtherProfilePlaceholder}
                      className="flex-1 bg-slate-50 dark:bg-light-blue-950 border border-slate-200 dark:border-light-blue-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-light-blue-500"
                    />
                    <button
                      type="button"
                      disabled={!customClearProfile.trim()}
                      onClick={() => handleClearSession(customClearProfile)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:bg-light-blue-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 border border-slate-200 dark:border-light-blue-700 text-xs font-semibold text-slate-700 dark:text-slate-100 disabled:opacity-40 transition cursor-pointer"
                    >
                      {t.resetBtn}
                    </button>
                  </div>
                  {sessionClearNotice && (
                    <div className="text-xs text-black-forest-600 dark:text-black-forest-400 font-medium">{sessionClearNotice}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* About App & Copyright Strip */}
          <div className="flex flex-col items-start gap-1 px-1 text-xs text-slate-400 dark:text-light-blue-300">
            <button
              type="button"
              onClick={handleOpenAbout}
              className="hover:text-light-blue-600 dark:hover:text-light-blue-200 transition cursor-pointer flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-light-blue-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t.aboutApp}</span>
            </button>
            <span className="text-xs">{t.allRightsReserved}</span>
          </div>
        </aside>
      </main>

      {/* Slide Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-light-blue-950/65 dark:bg-light-blue-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-light-blue-900 border border-slate-200 dark:border-light-blue-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-light-blue-800 mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingSlide?.id === 'system-standby'
                  ? t.modalStandbyTitle
                  : editingSlide
                    ? t.modalEditTitle
                    : t.modalAddTitle}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-700 dark:bg-rose-950/80 dark:border-rose-500/50 dark:text-rose-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSlide} className="flex flex-col gap-4">
              <div>
                <label htmlFor="modal_name" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  {t.slideNameLabel}
                </label>
                <input
                  id="modal_name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.slideNamePlaceholder}
                  className="w-full bg-slate-50 dark:bg-light-blue-950 border border-slate-300 dark:border-light-blue-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-light-blue-500"
                />
              </div>

              {editingSlide?.id === 'system-standby' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {t.wallpaperThemeLabel}
                      </label>
                      <button
                        type="button"
                        onClick={handleTestUrlFromModal}
                        className="text-[11px] font-semibold text-light-blue-600 hover:text-light-blue-500 dark:text-light-blue-300 cursor-pointer"
                      >
                        {t.previewFullscreen}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'solid', label: t.presetSolid, desc: t.presetSolidDesc },
                          { id: 'custom', label: t.presetCustom, desc: t.presetCustomDesc }
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, standby_preset: opt.id })}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            formData.standby_preset === opt.id
                              ? 'border-light-blue-500 bg-light-blue-50/70 dark:bg-light-blue-950/90 dark:border-light-blue-400'
                              : 'border-slate-200 dark:border-light-blue-800 bg-slate-50 dark:bg-light-blue-950/50 hover:border-slate-300 dark:hover:border-light-blue-700'
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{opt.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-light-blue-300 mt-0.5 leading-snug">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.standby_preset === 'solid' && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50 dark:bg-light-blue-950/70 border border-slate-200 dark:border-light-blue-800">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {t.solidColorLabel}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-light-blue-300">
                            {t.solidColorDesc}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.standby_color}
                            onChange={(e) => setFormData({ ...formData, standby_color: e.target.value })}
                            className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 dark:border-light-blue-700 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={formData.standby_color.toUpperCase()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                setFormData({ ...formData, standby_color: val });
                              }
                            }}
                            className="w-20 px-2 py-1 text-xs font-mono text-center rounded-lg border border-slate-300 dark:border-light-blue-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.standby_preset === 'custom' && (
                    <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-light-blue-950/70 border border-slate-200 dark:border-light-blue-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{t.wallpaperHeader}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-light-blue-800 text-slate-600 dark:text-light-blue-200">
                              {standbyWallpapers.length}/3
                            </span>
                            {totalWallpaperBytes > 0 && (
                              <span className="text-[10px] text-slate-400 dark:text-light-blue-300 font-normal">
                                ({formatFileSize(totalWallpaperBytes)})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-light-blue-300 mt-0.5">
                            {t.wallpaperMaxHint}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {standbyWallpapers.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllWallpapers}
                              className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-medium transition cursor-pointer flex items-center gap-1"
                              title={t.deleteAllTooltip}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>{t.deleteAll}</span>
                            </button>
                          )}
                          {standbyWallpapers.length < 3 ? (
                            <button
                              type="button"
                              onClick={handleUploadWallpapers}
                              className="px-3 py-1.5 rounded-xl bg-light-blue-600 hover:bg-light-blue-500 text-white text-xs font-semibold transition shrink-0 cursor-pointer flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              <span>{t.uploadBtn}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-light-blue-300 font-medium px-2 py-1 rounded-lg bg-slate-200/50 dark:bg-light-blue-800/60 border border-slate-200 dark:border-light-blue-700">
                              {t.max3Badge}
                            </span>
                          )}
                        </div>
                      </div>

                      {standbyWallpapers.length === 0 ? (
                        <div className="py-5 text-center border border-dashed border-slate-300 dark:border-light-blue-800 rounded-xl text-[11px] text-slate-400 dark:text-light-blue-300">
                          {t.noWallpaperUploaded}
                        </div>
                      ) : (
                        <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1">
                          {standbyWallpapers.map((item, idx) => (
                            <div
                              key={item.fileName}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-light-blue-900 border border-slate-200/80 dark:border-light-blue-800 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono text-slate-400 dark:text-light-blue-300 shrink-0">#{idx + 1}</span>
                                <span className="truncate font-medium text-slate-700 dark:text-slate-100" title={formatWallpaperDisplayName(item.fileName)}>
                                  {formatWallpaperDisplayName(item.fileName)}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-light-blue-300 shrink-0">
                                  {formatFileSize(item.sizeBytes)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteWallpaper(item.fileName)}
                                title={t.deleteThisImage}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:text-light-blue-300 dark:hover:text-rose-400 transition cursor-pointer shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="modal_url" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {t.urlOrIpLabel}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="modal_url"
                        type="text"
                        required
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder={t.urlPlaceholder}
                        className="flex-1 bg-slate-50 dark:bg-light-blue-950 border border-slate-300 dark:border-light-blue-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-light-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleTestUrlFromModal}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-light-blue-800 dark:hover:bg-light-blue-700 dark:text-slate-100 text-xs font-semibold border border-slate-300 dark:border-light-blue-700 transition shrink-0 cursor-pointer"
                      >
                        {t.testOpenBtn}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="modal_reload_interval" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {t.reloadModeLabel}
                    </label>
                    <select
                      id="modal_reload_interval"
                      value={formData.reload_interval}
                      onChange={(e) => setFormData({ ...formData, reload_interval: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-50 dark:bg-light-blue-950 border border-slate-300 dark:border-light-blue-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-light-blue-500 cursor-pointer"
                    >
                      <option value={0}>{t.reloadModeStandby}</option>
                      <option value={-1}>{t.reloadModeEveryTurn}</option>
                      <option value={5}>{t.reloadMode5m}</option>
                      <option value={15}>{t.reloadMode15m}</option>
                      <option value={30}>{t.reloadMode30m}</option>
                      <option value={60}>{t.reloadMode60m}</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-light-blue-300">
                      {formData.reload_interval === 0
                        ? t.reloadModeStandbyDesc
                        : formData.reload_interval === -1
                        ? t.reloadModeEveryTurnDesc
                        : t.reloadModeIntervalDesc}
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-light-blue-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-light-blue-200 dark:hover:text-white dark:hover:bg-light-blue-800 transition cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white shadow-md transition cursor-pointer"
                >
                  {t.saveWebsite}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 bg-light-blue-950/65 dark:bg-light-blue-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-light-blue-900 border border-slate-200 dark:border-light-blue-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-light-blue-800 mb-4">
              <div className="flex items-center gap-2.5">
                <Logo size={22} variant="mark-gradient" className="shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.shortcutsModalTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 divide-y divide-slate-100 dark:divide-light-blue-800/80">
              <div className="flex items-center justify-between text-xs py-1.5">
                <kbd className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                  {t.keySpace}
                </kbd>
                <span className="text-xs text-slate-600 dark:text-light-blue-200">{t.scPlayPause}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    ←
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    →
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-light-blue-200">{t.scPrevNext}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    F5
                  </kbd>
                  <span className="text-slate-400 text-[10px]">/</span>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    Ctrl+R
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-light-blue-200">{t.scReload}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    F11
                  </kbd>
                  <span className="text-slate-400 text-[10px]">/</span>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                    Esc
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-light-blue-200">{t.scFullscreen}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <kbd className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-light-blue-800 border border-slate-200 dark:border-light-blue-700 text-slate-700 dark:text-slate-200 rounded shadow-2xs">
                  Alt+S
                </kbd>
                <span className="text-xs text-slate-600 dark:text-light-blue-200">{t.scSettings}</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-light-blue-800">
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-light-blue-600 hover:bg-light-blue-500 text-white transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About App Modal */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 bg-light-blue-950/65 dark:bg-light-blue-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-light-blue-900 border border-slate-200 dark:border-light-blue-800 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center">
            <div className="w-full flex justify-end -mt-1 -mr-1">
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white cursor-pointer p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <Logo size={48} variant="mark-gradient" className="mb-3" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t.appName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-light-blue-300 mt-1 max-w-xs leading-relaxed">
              {t.aboutDescription}
            </p>

            <div className="w-full mt-4 rounded-xl bg-slate-50 dark:bg-light-blue-950/70 border border-slate-200/80 dark:border-light-blue-800 p-3 text-xs flex flex-col gap-2 text-left">
              <div className="flex items-center justify-between text-slate-600 dark:text-light-blue-300">
                <span>{t.appVersion}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {appInfo?.version || '1.0.0'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-light-blue-300">
                <span>Electron:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {appInfo?.electron ? `v${appInfo.electron}` : t.loadingText}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-light-blue-300">
                <span>Chromium:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {appInfo?.chrome ? `v${appInfo.chrome}` : t.loadingText}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-light-blue-300">
                <span>{t.osLabel}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {appInfo ? `${appInfo.os_type} ${appInfo.os_release} (${appInfo.arch})` : 'Windows'}
                </span>
              </div>
            </div>

            <div className="w-full mt-3.5">
              <button
                type="button"
                onClick={() => {
                  const summary = [
                    `OrbitSlide v${appInfo?.version || '1.0.0'}`,
                    `Electron: ${appInfo?.electron || '-'}`,
                    `Chromium: ${appInfo?.chrome || '-'}`,
                    `OS: ${appInfo?.os_type || '-'} ${appInfo?.os_release || '-'} (${appInfo?.arch || '-'})`
                  ].join('\n');
                  navigator.clipboard.writeText(summary);
                  setCopiedInfoNotice(true);
                  setTimeout(() => setCopiedInfoNotice(false), 2500);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-light-blue-800 dark:hover:bg-light-blue-700 dark:text-slate-100 text-xs font-semibold border border-slate-200 dark:border-light-blue-700 transition cursor-pointer"
              >
                {copiedInfoNotice ? t.copied : t.copyInfo}
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-light-blue-800 w-full flex items-center justify-between text-[11px] text-slate-400 dark:text-light-blue-300">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenLegal('terms')}
                  className="hover:text-light-blue-600 dark:hover:text-light-blue-200 transition cursor-pointer underline underline-offset-2"
                >
                  {t.termsShort}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('privacy')}
                  className="hover:text-light-blue-600 dark:hover:text-light-blue-200 transition cursor-pointer underline underline-offset-2"
                >
                  {t.privacyShort}
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleOpenLegal('license')}
                  className="hover:text-light-blue-600 dark:hover:text-light-blue-200 transition cursor-pointer underline underline-offset-2"
                >
                  {t.mitLicense}
                </button>
              </div>
              <span>© 2026 OrbitSlide</span>
            </div>
          </div>
        </div>
      )}

      {/* Legal & Privacy Policy Modal */}
      {isLegalModalOpen && (
        <div className="fixed inset-0 z-50 bg-light-blue-950/65 dark:bg-light-blue-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-light-blue-900 border border-slate-200 dark:border-light-blue-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-light-blue-800 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <Logo size={22} variant="mark-gradient" className="shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {legalTab === 'terms'
                    ? t.legalTermsTitle
                    : legalTab === 'privacy'
                    ? t.legalPrivacyTitle
                    : t.legalLicenseTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLegalModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:text-light-blue-300 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Segmented Tab Bar */}
            <div className="flex items-center bg-slate-100 dark:bg-light-blue-950 p-1 rounded-xl mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setLegalTab('terms')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                  legalTab === 'terms'
                    ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-light-blue-300 dark:hover:text-white'
                }`}
              >
                {t.legalTermsTab}
              </button>
              <button
                type="button"
                onClick={() => setLegalTab('privacy')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                  legalTab === 'privacy'
                    ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-light-blue-300 dark:hover:text-white'
                }`}
              >
                {t.legalPrivacyTab}
              </button>
              <button
                type="button"
                onClick={() => setLegalTab('license')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer text-center ${
                  legalTab === 'license'
                    ? 'bg-white dark:bg-light-blue-800 text-light-blue-700 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-light-blue-300 dark:hover:text-white'
                }`}
              >
                {t.legalLicenseTab}
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto no-scrollbar space-y-4 text-xs text-slate-600 dark:text-light-blue-200 leading-relaxed grow">
              {legalTab === 'terms' ? (
                language === 'en' ? (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/60 border border-slate-200/80 dark:border-light-blue-800 space-y-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        Welcome to <strong>OrbitSlide</strong>. Please read these Terms and Conditions of Use carefully before downloading, installing, or using the OrbitSlide desktop application.
                      </p>
                      <p>
                        By downloading, installing, running, or using the Application, you represent that you have read, understood, and agreed to be legally bound by these Terms as well as our Privacy Policy. If you do not agree to any or all parts of these Terms, you are not permitted to install or use this Application.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">1. Definitions</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Application</strong> means the OrbitSlide desktop software, including all source code, interface components, visual assets, updates, and related documentation developed and distributed by the OrbitSlide developers.</li>
                        <li><strong>User</strong> means any individual, business entity, institution, or organization that downloads, installs, configures, or operates the Application.</li>
                        <li><strong>User Content</strong> means all website links, wallpaper image files, browsing session data, text, and visual media input or loaded by the User into the Application.</li>
                        <li><strong>Monitoring Slide</strong> means any web page view, internal dashboard, or standby lock screen displayed sequentially or rotated within the Application.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">2. Software License Grant</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>License Rights:</strong> Subject to your compliance with these Terms, we grant you a non-exclusive, revocable, non-transferable, worldwide license to install and run the Application on computer hardware owned by you or under your authority.</li>
                        <li><strong>Open Source License:</strong> The source code components of the Application are distributed under the terms of the MIT License. You have the right to study, modify, and redistribute the code subject to the limitations set forth in the official MIT License text, while retaining the original copyright notice.</li>
                        <li><strong>Trademarks and Copyright:</strong> The OrbitSlide name, logo, visual identity, and interface design elements are intellectual property of the developers protected by applicable copyright laws in the Republic of Indonesia.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. Acceptable Use Policy</h4>
                      <p>
                        You agree to use the Application only for lawful purposes and in accordance with applicable laws and regulations, including but not limited to Law of the Republic of Indonesia Number 11 of 2008 concerning Electronic Information and Transactions as amended.
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">You are strictly prohibited from:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Using the Application to display, distribute, or facilitate content that is unlawful, involves gambling, pornography, hate speech, fraud, third-party copyright infringement, or other harmful materials.</li>
                        <li>Using the Application to launch attacks against network infrastructure, unauthorized penetration testing, denial-of-service attacks, or vulnerability scanning against target servers.</li>
                        <li>Compromising system integrity or injecting malware, viruses, or malicious code into the Application runtime environment.</li>
                        <li>Removing, altering, or concealing copyright notices, trademarks, or ownership attributions displayed within the Application.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">4. Responsibility for Displayed Content and URLs</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Full User Responsibility:</strong> OrbitSlide functions solely as a kiosk display viewer to rotate and display URL addresses that you enter. We have no control over the material, accuracy, availability, or legality of the website content you display.</li>
                        <li><strong>Public Display Rights:</strong> If you use the Application to display information on public monitors, exhibition halls, office screens, or open digital signage, you are solely responsible for ensuring that you have the permission, broadcasting license, or legal right to display such web content to the public.</li>
                        <li><strong>Credential Confidentiality:</strong> You are solely responsible for the security of credentials, API tokens, and passwords stored in local browsing sessions on your computer.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">5. SSL Security Certificate Bypass</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>The Application provides a technical configuration option to ignore SSL certificate errors. This feature is specifically designed to facilitate monitoring of internal operational intranet servers, IoT devices, network routers, or local dashboards such as Proxmox, Zabbix, and Cockpit that use self-signed digital certificates.</li>
                        <li>You understand and agree that enabling this option on public networks or the open internet carries potential security risks of data interception. Use of this feature is entirely the technical decision and responsibility of the User.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">6. Management of Session Profiles, Cookies, and Local Data</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>The Application provides session profile isolation based on the Chromium engine to allow separation of cookies and login sessions across slides.</li>
                        <li>All settings databases, URL links, rotation preferences, and uploaded wallpaper files are stored locally within the User application data directory (`%APPDATA%\OrbitSlide`).</li>
                        <li>You have full control to clear session history, cookies, cache, and delete wallpaper files at any time through the Application settings panel.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">7. Software Updates and Availability</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>We may from time to time release updates, bug fixes, or performance improvements for the Application.</li>
                        <li>We do not guarantee that a specific version of the Application will always be compatible with future versions of the Windows operating system or changes in third-party web browser specifications.</li>
                        <li>The Application is designed to operate standalone locally. Functional failures caused by lack of internet connection, target server downtime, or monitor hardware failure are outside our scope of control.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">8. Warranty Disclaimer</h4>
                      <p>
                        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE APPLICATION IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND FROM US, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ERROR-FREE OR UNINTERRUPTED OPERATION.
                      </p>
                      <p>
                        WE DO NOT GUARANTEE THAT USE OF THE APPLICATION WILL ALWAYS BE SAFE FROM POWER INTERRUPTIONS, OPERATING SYSTEM SECURITY POLICY CHANGES, OR MONITOR DISPLAY DAMAGE CAUSED BY PROLONGED STATIC IMAGE DISPLAY (SCREEN BURN-IN). USERS ARE ADVISED TO UTILIZE THE STANDBY SLIDE FEATURE OR PERIODIC SLIDE ROTATION TO PREVENT PHYSICAL SCREEN ISSUES.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">9. Limitation of Liability</h4>
                      <p>
                        UNDER NO CIRCUMSTANCES SHALL THE ORBITSLIDE DEVELOPERS BE LIABLE TO THE USER OR ANY THIRD PARTY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF BUSINESS PROFITS, WORK OPERATION INTERRUPTIONS, LOSS OR CORRUPTION OF DATA, FAILURE OF CRITICAL SYSTEM MONITORING, OR HARDWARE DAMAGE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">10. Indemnification</h4>
                      <p>
                        You agree to defend, indemnify, and hold harmless the OrbitSlide developers, affiliates, contributors, and partners from and against any claims, demands, liabilities, losses, costs, or expenses (including reasonable attorney fees) arising out of or related to:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Your violation of these Terms;</li>
                        <li>Your violation of any third-party rights, including intellectual property or privacy rights;</li>
                        <li>Any website content or media that you load and display through the Application.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">11. Governing Law and Dispute Resolution</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of Indonesia.</li>
                        <li>Any dispute or controversy arising from the interpretation or implementation of these Terms shall first be resolved amicably through deliberation to reach consensus within 30 (thirty) calendar days.</li>
                        <li>If consensus is not reached, the dispute shall be resolved through the jurisdiction of the competent district court in the developer's legal domicile.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">12. Severability</h4>
                      <p>
                        If any clause in these Terms is declared invalid, void, or unenforceable by a competent court, that provision shall be modified to the minimum extent necessary to make it enforceable, and the remaining clauses shall remain in full force and legal effect.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">13. Changes to Terms</h4>
                      <p>
                        We reserve the right to modify, update, or replace these Terms and Conditions at any time. Changes take effect once the updated document is included within the Application or official repository. Your continued use of the Application after such changes are published constitutes your acceptance of the new Terms.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">14. Developer Relations and Contact</h4>
                      <p>
                        If you have any questions, suggestions, or feedback regarding these Terms and Conditions, please contact the developers through the official project repository or the administrative contact of the OrbitSlide developers.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/60 border border-slate-200/80 dark:border-light-blue-800 space-y-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        Selamat datang di <strong>OrbitSlide</strong>. Harap membaca Syarat dan Ketentuan Penggunaan ini secara saksama sebelum mengunduh, memasang, atau menggunakan aplikasi desktop OrbitSlide.
                      </p>
                      <p>
                        Dengan mengunduh, memasang, menjalankan, atau menggunakan Aplikasi, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat secara hukum oleh Ketentuan ini serta Kebijakan Privasi kami. Apabila Anda tidak menyetujui salah satu atau seluruh bagian dari Ketentuan ini, Anda tidak diperkenankan untuk memasang atau menggunakan Aplikasi ini.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">1. Definisi</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Aplikasi</strong> berarti perangkat lunak desktop OrbitSlide, termasuk seluruh kode sumber, komponen antarmuka, aset visual, pembaruan, serta dokumentasi terkait yang dikembangkan dan didistribusikan oleh pengembang OrbitSlide.</li>
                        <li><strong>Pengguna</strong> adalah setiap individu, badan usaha, lembaga, atau organisasi yang mengunduh, memasang, mengonfigurasi, atau mengoperasikan Aplikasi.</li>
                        <li><strong>Konten Pengguna</strong> adalah seluruh tautan situs web (URL), berkas gambar wallpaper, data sesi penjelajahan, teks, dan media visual yang diinput atau dimuat oleh Pengguna ke dalam Aplikasi.</li>
                        <li><strong>Slide Monitoring</strong> adalah tampilan laman web, dashboard internal, atau layar siaga yang ditampilkan secara berurutan atau berotasi di dalam Aplikasi.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">2. Pemberian Lisensi Perangkat Lunak</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Hak Lisensi:</strong> Tunduk pada kepatuhan Anda terhadap Ketentuan ini, Kami memberi Anda lisensi yang bersifat non-eksklusif, dapat dibatalkan, tidak dapat dipindahtangankan, dan berlaku di seluruh dunia untuk memasang dan menjalankan Aplikasi pada perangkat keras komputer milik Anda atau yang berada di bawah wewenang Anda.</li>
                        <li><strong>Lisensi Terbuka (Open Source):</strong> Komponen kode sumber Aplikasi didistribusikan di bawah ketentuan Lisensi MIT. Anda berhak mempelajari, memodifikasi, dan mendistribusikan ulang kode sesuai batasan yang tercantum pada teks Lisensi MIT resmi, dengan tetap menyertakan pemberitahuan hak cipta asli.</li>
                        <li><strong>Merek Dagang dan Hak Cipta:</strong> Nama OrbitSlide, logo, identitas visual, dan elemen desain antarmuka merupakan kekayaan intelektual pengembang yang dilindungi oleh peraturan perundang-undangan hak cipta yang berlaku di Republik Indonesia.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. Penggunaan yang Diizinkan (Acceptable Use Policy)</h4>
                      <p>
                        Anda setuju untuk menggunakan Aplikasi hanya untuk tujuan yang sah dan sesuai dengan peraturan perundang-undangan yang berlaku, termasuk namun tidak terbatas pada Undang-Undang Republik Indonesia Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik sebagaimana telah diubah (UU ITE).
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">Anda dilarang keras untuk:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Menggunakan Aplikasi untuk menayangkan, menyebarkan, atau memfasilitasi konten yang melanggar hukum, mengandung unsur perjudian, pornografi, ujaran kebencian, penipuan, pelanggaran hak cipta pihak ketiga, atau materi berbahaya lainnya.</li>
                        <li>Menggunakan Aplikasi untuk melancarkan serangan terhadap infrastruktur jaringan, pengujian penetrasi tanpa izin, denial-of-service (DoS), atau pemindaian celah keamanan terhadap server target.</li>
                        <li>Merusak integritas sistem, menyisipkan malware, virus, atau kode berbahaya ke dalam lingkungan runtime Aplikasi.</li>
                        <li>Menghilangkan, mengubah, atau menyembunyikan pemberitahuan hak cipta, merek dagang, atau atribusi kepemilikan yang tertera pada Aplikasi.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">4. Tanggung Jawab atas Konten dan URL yang Ditayangkan</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Tanggung Jawab Penuh Pengguna:</strong> OrbitSlide berfungsi semata-mata sebagai peramban display (kiosk viewer) untuk merotasi dan menampilkan alamat URL yang Anda masukkan. Kami tidak memiliki kendali atas materi, keakuratan, ketersediaan, atau legalitas konten situs web yang Anda tampilkan.</li>
                        <li><strong>Hak Penayangan di Ruang Publik:</strong> Jika Anda menggunakan Aplikasi untuk menampilkan informasi pada monitor publik, ruang pameran, layar kantor, atau digital signage terbuka, Anda bertanggung jawab penuh untuk memastikan bahwa Anda memiliki izin, lisensi penyiaran, atau hak legal untuk menayangkan konten web tersebut kepada khalayak umum.</li>
                        <li><strong>Kerahasiaan Kredensial:</strong> Anda bertanggung jawab penuh atas keamanan kredensial, token API, dan kata sandi yang tersimpan pada sesi penjelajahan lokal di komputer Anda.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">5. Pengabaian Sertifikat Keamanan SSL (Self-Signed Certificates)</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Aplikasi menyediakan opsi konfigurasi teknis untuk mengabaikan kesalahan sertifikat SSL (ignore certificate errors). Fitur ini dirancang khusus untuk mempermudah pemantauan server operasional internal (intranet), perangkat IoT, router jaringan, atau dashboard lokal (seperti Proxmox, Zabbix, Cockpit) yang menggunakan sertifikat digital self-signed.</li>
                        <li>Anda memahami dan menyetujui bahwa mengaktifkan opsi ini pada jaringan publik atau internet terbuka berpotensi menimbulkan risiko keamanan intersepsi data (man-in-the-middle). Penggunaan fitur ini sepenuhnya merupakan keputusan dan tanggung jawab teknis Pengguna.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">6. Pengelolaan Profil Sesi, Kuki (Cookies), dan Data Lokal</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Aplikasi menyediakan fitur isolasi profil sesi (session partitioning) berbasis engine Chromium untuk memungkinkan pemisahan kuki dan sesi login antar-slide.</li>
                        <li>Seluruh basis data pengaturan, tautan URL, preferensi rotasi, serta berkas wallpaper yang diunggah disimpan secara lokal di dalam direktori data aplikasi Pengguna (`%APPDATA%\OrbitSlide`).</li>
                        <li>Anda memiliki kontrol penuh untuk membersihkan riwayat sesi, kuki, cache, dan menghapus berkas wallpaper kapan saja melalui panel pengaturan Aplikasi.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">7. Pembaruan dan Ketersediaan Perangkat Lunak</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Kami dapat dari waktu ke waktu merilis pembaruan, perbaikan bug, atau peningkatan performa untuk Aplikasi.</li>
                        <li>Kami tidak menjamin bahwa versi tertentu dari Aplikasi akan selalu kompatibel dengan versi sistem operasi Windows masa depan atau perubahan spesifikasi teknologi peramban web pihak ketiga.</li>
                        <li>Aplikasi dirancang untuk beroperasi secara mandiri (standalone) secara lokal. Kegagalan fungsi akibat ketiadaan koneksi internet, server tujuan down, atau kegagalan perangkat keras monitor berada di luar lingkup kontrol Kami.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">8. Penyangkalan Jaminan (Warranty Disclaimer)</h4>
                      <p>
                        SEJAUH DIIZINKAN OLEH HUKUM YANG BERLAKU, APLIKASI DISEDIAKAN ATAS DASAR "SEBAGAIMANA ADANYA" (AS IS) DAN "SEBAGAIMANA TERSEDIA" (AS AVAILABLE), TANPA JAMINAN APA PUN DARI KAMI, BAIK TERSURAT MAUPUN TERSIRAT, TERMASUK NAMUN TIDAK TERBATAS PADA JAMINAN KELAYAKAN JUAL, KESESUAIAN UNTUK TUJUAN TERTENTU, KETIADAAN PELANGGARAN, DAN KEBERLANJUTAN OPERASI BEBAS DARI KESALAHAN (ERROR-FREE ATAU UNINTERRUPTED).
                      </p>
                      <p>
                        KAMI TIDAK MENJAMIN BAHWA PENGGUNAAN APLIKASI AKAN SELALU AMAN DARI GANGGUAN DAYA LISTRIK, PERUBAHAN KEBIJAKAN KEAMANAN SISTEM OPERASI, ATAU KERUSAKAN TAMPILAN MONITOR AKIBAT PENAYANGAN GAMBAR STATIS DALAM WAKTU LAMA (BURN-IN SCREEN). PENGGUNA DIANJURKAN MEMANFAATKAN FITUR SLIDE STANDBY ATAU PERGANTIAN SLIDE BERKALA UNTUK MENCEGAH MASALAH FISIK LAYAR.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">9. Batasan Tanggung Jawab (Limitation of Liability)</h4>
                      <p>
                        DALAM KONDISI APA PUN, PENGEMBANG ORBITSLIDE TIDAK BERTANGGUNG JAWAB KEPADA PENGGUNA ATAU PIHAK KETIGA ATAS SETIAP KERUGIAN TIDAK LANGSUNG, INSIDENTAL, KHUSUS, KONSEKUENSIAL, ATAU PUNITIF, TERMASUK NAMUN TIDAK TERBATAS PADA KEHILANGAN KEUNTUNGAN BISNIS, TERHENTINYA OPERASIONAL KERJA, KEHILANGAN ATAU KERUSAKAN DATA, KEGAGALAN MONITORING SISTEM KRITIS, ATAU KERUSAKAN HARDWARE, MESKIPUN KAMI TELAH DIBERITAHU MENGENAI KEMUNGKINAN KERUGIAN TERSEBUT.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">10. Ganti Rugi (Indemnification)</h4>
                      <p>
                        Anda setuju untuk membela, mengganti rugi, dan membebaskan pengembang OrbitSlide, afiliasi, kontributor, dan mitra dari dan terhadap setiap klaim, tuntutan, kewajiban, kerugian, biaya, atau pengeluaran (termasuk biaya advokat yang wajar) yang timbul dari atau terkait dengan:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Pelanggaran Anda terhadap Ketentuan ini;</li>
                        <li>Pelanggaran Anda terhadap hak pihak ketiga mana pun, termasuk hak kekayaan intelektual atau privasi;</li>
                        <li>Konten situs web atau media apa pun yang Anda muat dan tayangkan melalui Aplikasi.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">11. Hukum yang Berlaku dan Penyelesaian Sengketa</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Negara Kesatuan Republik Indonesia.</li>
                        <li>Segala perselisihan atau sengketa yang timbul dari penafsiran atau pelaksanaan Ketentuan ini akan diselesaikan terlebih dahulu melalui musyawarah untuk mencapai mufakat dalam jangka waktu 30 (tiga puluh) hari kalender.</li>
                        <li>Apabila mufakat tidak tercapai, sengketa akan diselesaikan melalui yurisdiksi pengadilan negeri yang berwenang di wilayah hukum domisili pengembang.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">12. Keterpisahan (Severability)</h4>
                      <p>
                        Apabila salah satu klausul dalam Ketentuan ini dinyatakan tidak sah, tidak berlaku, atau tidak dapat dilaksanakan oleh pengadilan yang berwenang, ketentuan tersebut harus diubah seminimal mungkin agar dapat dilaksanakan, dan klausul lainnya akan tetap berlaku penuh serta berkekuatan hukum.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">13. Perubahan Ketentuan</h4>
                      <p>
                        Kami berhak untuk mengubah, memperbarui, atau mengganti Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan berlaku efektif setelah dokumen yang diperbarui dicantumkan di dalam Aplikasi atau repositori resmi. Penggunaan berkelanjutan Anda atas Aplikasi setelah perubahan tersebut dipublikasikan menandakan penerimaan Anda terhadap Ketentuan yang baru.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">14. Hubungan Pengembang dan Kontak</h4>
                      <p>
                        Apabila Anda memiliki pertanyaan, saran, atau masukan mengenai Syarat dan Ketentuan ini, silakan hubungi pengembang melalui repositori resmi proyek atau kontak administratif pengembang OrbitSlide.
                      </p>
                    </div>
                  </>
                )
              ) : legalTab === 'privacy' ? (
                language === 'en' ? (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/60 border border-slate-200/80 dark:border-light-blue-800 space-y-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        Welcome to <strong>OrbitSlide</strong>. Your privacy is our top priority. This Privacy Policy explains how the OrbitSlide desktop application treats information and data when you use our software.
                      </p>
                      <p>
                        This Privacy Policy is prepared with reference to data protection principles applicable in the Republic of Indonesia, specifically <strong>Law of the Republic of Indonesia Number 27 of 2022 concerning Personal Data Protection (UU PDP)</strong> and relevant global privacy standards. By installing and using the Application, you consent to the data handling practices described in this document.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">1. Core Principles: Local Architecture and Zero-Telemetry</h4>
                      <p>OrbitSlide is built with a <strong>Privacy by Design</strong> and <strong>Local-First Architecture</strong> philosophy:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Zero-Telemetry:</strong> The Application DOES NOT collect, DOES NOT track, and DOES NOT transmit usage analytics, telemetry data, user identities, visited site history, or monitoring behavior to developer servers or any third party.</li>
                        <li><strong>Full Client-Side Storage:</strong> All configuration data, slide lists, web links, interval settings, and image files you enter are stored 100% locally on your computer storage device.</li>
                        <li><strong>No Centralized User Account:</strong> You are not required to register an account, enter an email address, phone number, or other personal identity to use all features of the Application.</li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">2. Information Processed and Stored Locally</h4>
                      <p>The Application processes several categories of technical data strictly required to perform display and monitor rotation functions:</p>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">A. Slide Configuration Data</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Link Address (URL):</strong> Website or local dashboard addresses you specify for monitor rotation.</li>
                          <li><strong>Slide Label & Duration:</strong> Slide display name and duration (in seconds).</li>
                          <li><strong>Display Order:</strong> The slide rotation sequence you configure.</li>
                          <li><strong>Storage Location:</strong> Stored in a structured local SQLite database (`orbitslide.db`) inside the user data folder (`userData`).</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">B. Web Browsing Sessions and Cookies</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Cookies and Login Sessions:</strong> When you open web pages requiring login (such as Grafana or internal dashboards), the built-in Chromium engine stores sessions and cookies in a local partition profile (`persist:profile_name`).</li>
                          <li><strong>Confidentiality:</strong> Those cookies and session data can never be accessed by OrbitSlide developers or sent to external parties.</li>
                          <li><strong>Full Control:</strong> You can clear session data and profile cookies at any time through the "Session & Cookie Profiles" settings menu in the Application.</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">C. Custom Wallpaper Files (Standby Lock Screen)</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Image Files:</strong> Background image files you upload for the standby screen (JPG, PNG, WEBP, GIF, etc.) are copied to the local folder `%APPDATA%\OrbitSlide\wallpapers`.</li>
                          <li><strong>Retention Policy:</strong> Images are kept only as long as you need them. When you delete an image through the Application interface, the physical file is permanently deleted from your computer storage using direct file system calls (`fs.unlinkSync`).</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">D. Device System Information (For Diagnostic Display Only)</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Diagnostic Information:</strong> Windows OS version, processor architecture (x64/arm64), Electron version, Chromium version, and local IPv4 address.</li>
                          <li><strong>Purpose:</strong> Read in real time at runtime solely for display in the "About Application" window and standby screen widget. This information is NEVER sent outside the device.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. Legal Basis for Data Processing (Under UU PDP)</h4>
                      <p>Pursuant to Article 20 of Law Number 27 of 2022 concerning Personal Data Protection, local data processing performed by the Application is based on:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Valid and Explicit Consent:</strong> The User independently enters URLs and image files into the Application for monitor display operations.</li>
                        <li><strong>Fulfillment of Contractual / Functional Obligations:</strong> Processing of configuration data is carried out solely so the Application can perform the core functions expected by the User (loading slides, rotating displays, and maintaining browsing sessions).</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">4. No Data Sharing with Third Parties</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>We do not sell, trade, rent, or share any User data with any third party.</li>
                        <li>The Application does not include third-party SDKs, Google Analytics, Facebook Pixel, tracking ads, or external monitoring scripts in its core codebase.</li>
                        <li>All network communication during slide playback occurs directly between your computer device and the target URL server you configured, without passing through any proxy server owned by OrbitSlide developers.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">5. Data Security</h4>
                      <p>Although the Application does not store your data in the cloud, device-level data security remains an important priority:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Isolated Storage:</strong> Data files are stored in the standard Windows user application data directory protected by your operating system user account permissions.</li>
                        <li><strong>Session Partition Isolation:</strong> Each browsing session profile is strictly isolated by Chromium Context Partitioning to prevent cross-session cookie leakage.</li>
                        <li><strong>User Security Responsibility:</strong> Physical computer security, Windows OS account password protection, and antivirus or firewall usage on the host device are the responsibility of the User.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">6. Personal Data Subject Rights</h4>
                      <p>In accordance with Chapter IV of Law Number 27 of 2022 concerning Personal Data Protection (UU PDP), Users have the following rights exercisable directly and independently within the Application:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Right to Access Information:</strong> You have the right to view all data stored within the Application at any time via the Settings menu.</li>
                        <li><strong>Right to Update and Rectify:</strong> You have the right to change URL addresses, slide names, durations, wallpaper themes, or other configurations at any time.</li>
                        <li><strong>Right to Erasure:</strong> You can delete slides individually or entirely, clear cookies and login sessions via the "Reset Cookie" button, delete wallpaper images or use "Delete All" to wipe all image files from disk, and uninstall the Application plus delete `%APPDATA%\OrbitSlide` to remove 100% of related data.</li>
                        <li><strong>Right to Withdraw Consent:</strong> You can stop using the Application at any time by closing or uninstalling it from your computer.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">7. Links to Third-Party Websites</h4>
                      <p>
                        The Application loads and displays external websites specified by the User. This Privacy Policy ONLY governs the OrbitSlide Application. When the Application loads external websites (such as Google, Grafana Cloud, news portals, or third-party vendor dashboards), the privacy policy and terms of use of those respective websites apply to data you submit to them. We encourage you to read the privacy policies of every external website you display.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">8. Children's Privacy Protection</h4>
                      <p>
                        The Application is not specifically directed at children under the age of 13, and never knowingly collects personally identifiable information from children. Because all data is local to the User's device, supervision of hardware usage by minors is the responsibility of parents or guardians.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">9. Changes to This Privacy Policy</h4>
                      <p>
                        We may update this Privacy Policy from time to time to reflect updates to Application features or changes in applicable legal regulations. The latest version will always be listed with the "Last Updated" date on this document. You are advised to review this page periodically.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">10. Developer Contact and Information</h4>
                      <p>
                        If you have any questions, clarifications, or concerns regarding this Privacy Policy or privacy handling in the OrbitSlide application, please open a discussion or report through the official project repository or administrative communication channels of the OrbitSlide developers.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/60 border border-slate-200/80 dark:border-light-blue-800 space-y-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        Selamat datang di <strong>OrbitSlide</strong>. Privasi Anda adalah prioritas utama kami. Kebijakan Privasi ini menjelaskan bagaimana aplikasi desktop OrbitSlide memperlakukan informasi dan data saat Anda menggunakan perangkat lunak kami.
                      </p>
                      <p>
                        Kebijakan Privasi ini disusun dengan mengacu pada prinsip-prinsip perlindungan data yang berlaku di Republik Indonesia, khususnya <strong>Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)</strong> serta standar privasi global yang relevan. Dengan memasang dan menggunakan Aplikasi, Anda menyetujui praktik penanganan data yang diuraikan dalam dokumen ini.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">1. Prinsip Utama: Arsitektur Lokal dan Bebas Pelacakan (Zero-Telemetry)</h4>
                      <p>OrbitSlide dibangun dengan filosofi <strong>Privacy by Design</strong> dan <strong>Local-First Architecture</strong>:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Bebas Pelacak (Zero-Telemetry):</strong> Aplikasi TIDAK mengumpulkan, TIDAK melacak, dan TIDAK mentransmisikan data analitik penggunaan, data telemetri, identitas pengguna, riwayat situs yang dikunjungi, atau perilaku pemantauan ke server pengembang maupun pihak ketiga mana pun.</li>
                        <li><strong>Penyimpanan Lokal Penuh (Client-Side Storage):</strong> Seluruh data konfigurasi, daftar slide, tautan web, pengaturan interval, dan berkas gambar yang Anda masukkan disimpan 100% secara lokal pada penyimpanan perangkat komputer Anda.</li>
                        <li><strong>Tanpa Akun Pengguna Terpusat:</strong> Anda tidak diwajibkan untuk mendaftar akun, memasukkan alamat email, nomor telepon, atau identitas pribadi lainnya untuk menggunakan seluruh fitur Aplikasi.</li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">2. Informasi yang Diproses dan Disimpan Secara Lokal</h4>
                      <p>Aplikasi memproses beberapa kategori data teknis yang semata-mata diperlukan untuk menjalankan fungsi display dan rotasi monitor:</p>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">A. Data Konfigurasi Slide</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Alamat Tautan (URL):</strong> Alamat website atau dashboard lokal yang Anda tentukan untuk ditampilkan pada rotasi monitor.</li>
                          <li><strong>Label Slide & Durasi:</strong> Nama penanda slide dan waktu tayang (dalam detik).</li>
                          <li><strong>Urutan Tampilan:</strong> Susunan rotasi slide yang Anda atur.</li>
                          <li><strong>Lokasi Penyimpanan:</strong> Tersimpan secara terstruktur di basis data SQLite lokal (`orbitslide.db`) di dalam folder data pengguna (`userData`).</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">B. Sesi Penjelajahan Web dan Kuki (Cookies)</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Kuki dan Sesi Login:</strong> Saat Anda membuka laman web yang memerlukan login (misalnya Grafana atau dashboard internal), engine Chromium bawaan Aplikasi menyimpan sesi dan kuki pada profil partisi lokal (`persist:profile_name`).</li>
                          <li><strong>Kerahasiaan:</strong> Kuki dan data sesi tersebut tidak pernah dapat diakses oleh pengembang OrbitSlide atau dikirim ke pihak luar.</li>
                          <li><strong>Kontrol Penuh:</strong> Anda dapat menghapus data sesi dan kuki profil kapan saja melalui menu pengaturan "Profil Sesi & Cookie" di Aplikasi.</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">C. Berkas Wallpaper Kustom (Standby Lock Screen)</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Berkas Gambar:</strong> Berkas gambar latar belakang yang Anda unggah untuk layar siaga (format JPG, PNG, WEBP, GIF, dsb.) disalin ke folder lokal `%APPDATA%\OrbitSlide\wallpapers`.</li>
                          <li><strong>Kebijakan Retensi:</strong> Gambar disimpan hanya selama Anda membutuhkannya. Saat Anda menghapus gambar melalui antarmuka Aplikasi, berkas fisik langsung dihapus permanen dari media penyimpanan komputer Anda menggunakan pemanggilan sistem berkas langsung (`fs.unlinkSync`).</li>
                        </ul>
                      </div>

                      <div className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-light-blue-800">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">D. Informasi Sistem Perangkat (Hanya untuk Tampilan Diagnostik)</div>
                        <ul className="list-disc list-inside space-y-0.5 pl-1">
                          <li><strong>Informasi Diagnostik:</strong> Versi sistem operasi Windows, arsitektur prosesor (x64/arm64), versi engine Electron, Chromium, dan alamat IP lokal (IPv4).</li>
                          <li><strong>Tujuan:</strong> Informasi ini dibaca secara real-time pada saat runtime hanya untuk keperluan tampilan di jendela "Tentang Aplikasi" dan informasi widget pada layar standby. Informasi ini TIDAK PERNAH dikirim ke luar perangkat.</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">3. Dasar Hukum Pemrosesan Data (Sesuai UU PDP)</h4>
                      <p>Berdasarkan ketentuan Pasal 20 Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi, pemrosesan data lokal yang dilakukan oleh Aplikasi berlandaskan pada:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Persetujuan yang Sah dan Eksplisit:</strong> Pengguna secara mandiri memasukkan URL dan berkas gambar ke dalam Aplikasi untuk keperluan operasional display monitor.</li>
                        <li><strong>Pemenuhan Kewajiban Kontraktual / Fungsional:</strong> Pemrosesan data konfigurasi dilakukan semata-mata agar Aplikasi dapat menjalankan fungsi dasar yang diharapkan oleh Pengguna (memuat slide, merotasi tampilan, dan memelihara sesi penjelajahan).</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">4. Tidak Ada Pembagian Data kepada Pihak Ketiga</h4>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Kami tidak menjual, memperdagangkan, menyewakan, atau membagikan data apa pun milik Pengguna kepada pihak ketiga mana pun.</li>
                        <li>Aplikasi tidak menyertakan SDK pihak ketiga, Google Analytics, Facebook Pixel, iklan pelacak, atau skrip pemantau eksternal apa pun di dalam kode aplikasi dasarnya.</li>
                        <li>Seluruh komunikasi jaringan yang terjadi saat penayangan slide berlangsung secara langsung antara perangkat komputer Anda dan server dari alamat URL yang Anda tuju, tanpa melalui server perantara (proxy) milik pengembang OrbitSlide.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">5. Keamanan Data</h4>
                      <p>Meskipun Aplikasi tidak menyimpan data Anda di awan (cloud), keamanan data pada tingkat perangkat komputer Anda tetap menjadi perhatian penting:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Penyimpanan Terisolasi:</strong> Berkas data disimpan di direktori data aplikasi standar sistem operasi Windows yang dilindungi oleh hak akses akun pengguna sistem operasi Anda.</li>
                        <li><strong>Isolasi Partisi Sesi:</strong> Setiap profil sesi penjelajahan diisolasi secara ketat oleh Chromium Context Partitioning guna mencegah kebocoran kuki lintas-sesi.</li>
                        <li><strong>Tanggung Jawab Keamanan Pengguna:</strong> Keamanan fisik komputer, proteksi kata sandi akun sistem operasi Windows, dan penggunaan antivirus atau firewall pada perangkat tempat Aplikasi berjalan merupakan tanggung jawab Pengguna.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">6. Hak-Hak Subjek Data Pribadi</h4>
                      <p>Sesuai dengan ketentuan Bab IV Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP), Pengguna memiliki hak-hak berikut yang dapat dilaksanakan secara langsung dan mandiri di dalam Aplikasi:</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li><strong>Hak untuk Mengakses Informasi:</strong> Anda berhak melihat seluruh data yang tersimpan di dalam Aplikasi kapan saja melalui menu Pengaturan.</li>
                        <li><strong>Hak untuk Memperbarui dan Memperbaiki:</strong> Anda berhak mengubah alamat URL, nama slide, durasi, tema wallpaper, atau konfigurasi lainnya setiap saat.</li>
                        <li><strong>Hak untuk Menghapus dan Memusnahkan (Right to Erasure):</strong> Anda dapat menghapus slide secara individual atau menyeluruh, menghapus kuki dan sesi login melalui tombol "Reset Cookie", menghapus gambar wallpaper kapan saja atau menggunakan opsi "Hapus Semua" untuk memusnahkan seluruh berkas gambar dari disk, serta mencopot instalasi Aplikasi dan menghapus folder `%APPDATA%\OrbitSlide` untuk melenyapkan 100% data terkait tanpa meninggalkan jejak di server luar.</li>
                        <li><strong>Hak untuk Menarik Persetujuan:</strong> Anda dapat menghentikan penggunaan Aplikasi kapan saja dengan menutup atau mencopot pemasangan (uninstall) Aplikasi dari komputer Anda.</li>
                      </ol>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">7. Tautan ke Situs Web Pihak Ketiga</h4>
                      <p>
                        Aplikasi berfungsi untuk memuat dan menampilkan situs web eksternal yang ditentukan oleh Pengguna. Kebijakan Privasi ini HANYA mengatur Aplikasi OrbitSlide. Saat Aplikasi memuat situs web eksternal (seperti Google, Grafana Cloud, portal berita, atau dashboard vendor pihak ketiga), kebijakan privasi dan ketentuan penggunaan dari situs web bersangkutan yang akan berlaku atas data yang Anda kirimkan ke situs web tersebut. Kami mendorong Anda untuk membaca kebijakan privasi dari setiap situs web eksternal yang Anda tayangkan.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">8. Perlindungan Privasi Anak</h4>
                      <p>
                        Aplikasi tidak ditujukan secara khusus untuk anak-anak di bawah usia 13 tahun, dan Aplikasi tidak pernah secara sengaja mengumpulkan data identifikasi pribadi dari anak-anak. Karena seluruh data bersifat lokal di perangkat Pengguna, pengawasan penggunaan perangkat keras oleh anak di bawah umur berada di bawah tanggung jawab orang tua atau wali.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">9. Perubahan pada Kebijakan Privasi</h4>
                      <p>
                        Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu untuk menyesuaikan dengan pembaruan fitur Aplikasi atau perubahan regulasi hukum yang berlaku. Versi terbaru akan selalu dicantumkan dengan tanggal "Terakhir Diperbarui" pada dokumen ini. Anda disarankan untuk memeriksa halaman ini secara berkala.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">10. Kontak dan Informasi Pengembang</h4>
                      <p>
                        Apabila Anda memiliki pertanyaan, klarifikasi, atau kekhawatiran mengenai Kebijakan Privasi ini atau penanganan privasi pada aplikasi OrbitSlide, silakan membuka diskusi atau melaporkan melalui repositori resmi proyek atau saluran komunikasi administratif pengembang OrbitSlide.
                      </p>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-light-blue-950/60 border border-slate-200/80 dark:border-light-blue-800">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {language === 'en'
                        ? 'OrbitSlide is free and open-source software distributed under the MIT License. You are free to use, copy, modify, merge, publish, and distribute this software for personal or commercial use.'
                        : 'OrbitSlide adalah perangkat lunak bebas dan sumber terbuka yang didistribusikan di bawah Lisensi MIT. Anda bebas menggunakan, menyalin, memodifikasi, menggabungkan, menerbitkan, dan mendistribusikan perangkat lunak ini secara gratis, baik untuk keperluan pribadi maupun komersial.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {language === 'en' ? 'Official MIT License Terms' : 'Ketentuan Lisensi MIT Resmi'}
                    </h4>
                    <pre className="p-3.5 rounded-xl bg-slate-100 dark:bg-light-blue-950 text-slate-700 dark:text-light-blue-200 text-[11px] font-mono whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-light-blue-800">
{`MIT License

Copyright (c) 2026 OrbitSlide

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
                    </pre>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3.5 mt-4 border-t border-slate-100 dark:border-light-blue-800 shrink-0 text-[11px] text-slate-400 dark:text-light-blue-300">
              <span>{t.lastUpdated}</span>
              <button
                type="button"
                onClick={() => setIsLegalModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-light-blue-600 hover:bg-light-blue-500 text-white transition cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
