import React, { useState, useEffect, useMemo } from 'react';
import { WebsiteSlide, AppSettings, SlideRuntimeStatus, KioskSystemInfo } from '../../types';
import { Logo } from './Logo';

interface SettingsPageProps {
  slideStatuses: Record<string, SlideRuntimeStatus>;
  theme: 'dark' | 'light' | 'system';
  onSetTheme: (theme: 'dark' | 'light' | 'system') => void;
  onCycleTheme: () => void;
  onStartMonitoring: () => void;
  onOpenPopup: (url: string, profile: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  slideStatuses,
  theme,
  onSetTheme,
  onCycleTheme,
  onStartMonitoring,
  onOpenPopup
}) => {
  const [websites, setWebsites] = useState<WebsiteSlide[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    auto_start_monitoring: true,
    idle_timeout_seconds: 30,
    default_duration: 15,
    start_fullscreen: false,
    theme: 'system',
    slide_animation: true,
    launch_on_startup: false,
    ignore_certificate_errors: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<WebsiteSlide | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isKioskModalOpen, setIsKioskModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'preferences' | 'kiosk_session'>('preferences');
  const [copiedScriptNotice, setCopiedScriptNotice] = useState(false);
  const [kioskInfo, setKioskInfo] = useState<KioskSystemInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearProfile, setConfirmClearProfile] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    duration: 15,
    session_profile: 'default',
    keep_alive: false,
    is_active: true
  });

  const [customClearProfile, setCustomClearProfile] = useState('');
  const [sessionClearNotice, setSessionClearNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData(websites.length === 0);
  }, []);

  const loadData = async (showLoading = websites.length === 0) => {
    if (showLoading) setIsLoading(true);
    try {
      if (!window.monitorAPI) {
        throw new Error('Bridge preload tidak ditemukan.');
      }
      const [loadedWebsites, loadedSettings, loadedKiosk] = await Promise.all([
        window.monitorAPI.getWebsites(),
        window.monitorAPI.getSettings(),
        window.monitorAPI.getKioskInfo ? window.monitorAPI.getKioskInfo() : Promise.resolve(null)
      ]);
      setWebsites(loadedWebsites);
      setSettings(loadedSettings);
      if (loadedKiosk) {
        setKioskInfo(loadedKiosk);
      }
    } catch (error) {
      console.error('Gagal memuat konfigurasi:', error);
    } finally {
      setIsLoading(false);
    }
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
      return { valid: false, url: '', error: 'URL atau alamat IP website wajib diisi.' };
    }

    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'http://' + normalized;
    }

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, url: normalized, error: 'URL harus menggunakan protokol http:// atau https://' };
      }
      if (!parsed.hostname) {
        return { valid: false, url: normalized, error: 'Hostname atau alamat IP tidak valid.' };
      }
      return { valid: true, url: normalized };
    } catch {
      return {
        valid: false,
        url: normalized,
        error: 'Format URL atau IP tidak valid. Contoh: http://10.6.3.120:3003'
      };
    }
  };

  const handleOpenAddForm = () => {
    setEditingSlide(null);
    setFormData({
      name: '',
      url: '',
      duration: settings.default_duration || 15,
      session_profile: 'default',
      keep_alive: false,
      is_active: true
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (slide: WebsiteSlide) => {
    setEditingSlide(slide);
    setFormData({
      name: slide.name,
      url: slide.url,
      duration: slide.duration,
      session_profile: slide.session_profile || 'default',
      keep_alive: slide.keep_alive,
      is_active: slide.is_active
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError('Nama website wajib diisi.');
      return;
    }

    const urlCheck = normalizeAndValidateUrl(formData.url);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error || 'URL tidak valid.');
      return;
    }

    const slideToSave = {
      id: editingSlide ? editingSlide.id : `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      url: urlCheck.url,
      duration: settings.default_duration || 15,
      sort_order: editingSlide ? editingSlide.sort_order : websites.length,
      is_active: formData.is_active,
      keep_alive: formData.keep_alive,
      session_profile: editingSlide?.session_profile || 'default'
    };

    try {
      await window.monitorAPI.saveWebsite(slideToSave);
      setIsFormOpen(false);
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setFormError(`Gagal menyimpan website: ${msg}`);
    }
  };

  const handleTestUrlFromModal = () => {
    const urlCheck = normalizeAndValidateUrl(formData.url);
    if (!urlCheck.valid) {
      setFormError(urlCheck.error || 'URL tidak valid untuk diuji.');
      return;
    }
    onOpenPopup(urlCheck.url, formData.session_profile.trim() || 'default');
  };

  const handleDeleteSlide = async (id: string) => {
    await window.monitorAPI.deleteWebsite(id);
    setConfirmDeleteId(null);
    await loadData();
  };

  const handleMoveSlide = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= websites.length) return;

    const newOrder = [...websites];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const orderedIds = newOrder.map((item) => item.id);
    await window.monitorAPI.reorderWebsites(orderedIds);
    await loadData();
  };

  const handleToggleActive = async (slide: WebsiteSlide) => {
    await window.monitorAPI.saveWebsite({
      ...slide,
      is_active: !slide.is_active
    });
    await loadData();
  };

  const handleSettingChange = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
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
    setSessionClearNotice(`Data sesi dan cookie profil "${target}" berhasil dihapus.`);
    setTimeout(() => setSessionClearNotice(null), 4000);
  };

  const getStatusBadge = (slideId: string) => {
    const st = slideStatuses[slideId];
    if (!st || st.status === 'idle') {
      return null;
    }
    if (st.status === 'ready') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-500/40 dark:text-emerald-300">
          Terhubung
        </span>
      );
    }
    if (st.status === 'loading') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950/80 dark:border-sky-500/40 dark:text-sky-300 animate-pulse">
          Memuat...
        </span>
      );
    }
    return (
      <span
        className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/80 dark:border-rose-500/40 dark:text-rose-300"
        title={st.error_message}
      >
        Gagal Dimuat
      </span>
    );
  };

  const activeWebsitesCount = websites.filter((w) => w.is_active).length;

  const kioskInstallCmd = `powershell -ExecutionPolicy Bypass -File "${
    kioskInfo?.app_path ? `${kioskInfo.app_path}\\scripts\\setup-windows-kiosk.ps1` : '.\\scripts\\setup-windows-kiosk.ps1'
  }" -InstallTask`;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Logo size={34} variant="mark-gradient" className="shrink-0" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">MonitorSlide</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Rotasi website dan dashboard otomatis</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Theme Cycle Button */}
          <button
            type="button"
            onClick={onCycleTheme}
            title={
              theme === 'light'
                ? 'Tema: Terang (Klik untuk ganti ke Gelap)'
                : theme === 'dark'
                  ? 'Tema: Gelap (Klik untuk ganti ke Ikuti Sistem)'
                  : 'Tema: Sistem (Klik untuk ganti ke Terang)'
            }
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs"
          >
            {theme === 'light' && (
              <>
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Terang</span>
              </>
            )}
            {theme === 'dark' && (
              <>
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Gelap</span>
              </>
            )}
            {theme === 'system' && (
              <>
                <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Sistem</span>
              </>
            )}
          </button>

          {/* Keyboard Shortcuts Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            title="Lihat daftar pintasan keyboard"
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span>Pintasan</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddForm}
            className="h-9 flex items-center gap-1.5 px-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-800 border text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>Tambah Website</span>
          </button>

          <button
            type="button"
            onClick={onStartMonitoring}
            disabled={activeWebsitesCount === 0}
            className={`h-9 flex items-center gap-2 px-4 rounded-xl font-semibold text-xs shadow-xs transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              activeWebsitesCount > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Mulai Monitoring ({activeWebsitesCount} Slide)</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Website List (2 Cols) */}
        <section className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Daftar Website</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih "Uji / Login" untuk login akun atau memeriksa tampilan sebelum rotasi dimulai.
              </p>
            </div>
          </div>

          {isLoading && websites.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-sm">Memuat konfigurasi...</div>
          ) : websites.length === 0 ? (
            <div className="p-10 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center bg-white dark:bg-slate-900/40 shadow-xs flex flex-col items-center">
              <Logo size={52} variant="mark-gradient" className="mb-3" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Belum ada website</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                Tambahkan tautan atau alamat IP lokal dashboard (misal: Grafana, Zabbix, atau web service) untuk ditampilkan berurutan.
              </p>
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                Tambah Website Pertama
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {websites.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    slide.is_active
                      ? 'bg-white border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 dark:bg-slate-950/60 dark:border-slate-900 opacity-60'
                  }`}
                >
                  {/* Order & Reorder Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                      #{index + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 'up')}
                        disabled={index === 0}
                        title="Geser Naik"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 'down')}
                        disabled={index === websites.length - 1}
                        title="Geser Turun"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Website Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {slide.name}
                      </h3>
                      {getStatusBadge(slide.id)}
                      {slide.keep_alive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/80 dark:border-emerald-500/40 dark:text-emerald-300">
                          Live Background
                        </span>
                      )}
                      {slide.session_profile && slide.session_profile !== 'default' && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Sesi: {slide.session_profile}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={slide.url}>
                      {slide.url}
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/70 dark:border-indigo-500/30 px-2.5 py-1 rounded-lg">
                      {slide.duration}s
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenPopup(slide.url, slide.session_profile)}
                      title="Buka website untuk uji koneksi atau login akun"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      Uji / Login
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(slide)}
                      title={slide.is_active ? 'Slide Aktif (Klik untuk nonaktifkan)' : 'Slide Nonaktif (Klik untuk aktifkan)'}
                      className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                        slide.is_active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      title="Edit Slide"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    {confirmDeleteId === slide.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(slide.id)}
                        title="Hapus Slide"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Tabbed Settings Card (Preferensi | Kiosk & Sesi) */}
        <aside className="flex flex-col gap-4">
          <div className="bg-white border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
            {/* Segmented Tab Bar */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSettingsTab('preferences')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  settingsTab === 'preferences'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Preferensi
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab('kiosk_session')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  settingsTab === 'kiosk_session'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Kiosk & Sesi
              </button>
            </div>

            {/* Tab 1: Preferensi Monitoring */}
            {settingsTab === 'preferences' && (
              <div className="flex flex-col gap-4">
                {/* Theme Selector */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Tema Tampilan</span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onSetTheme('light')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>Terang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTheme('dark')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span>Gelap</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetTheme('system')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                        theme === 'system'
                          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Sistem</span>
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80">
                  {/* Auto-start */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Auto-start Monitoring</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Putar rotasi slide langsung saat aplikasi dibuka</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.auto_start_monitoring}
                      onClick={() => handleSettingChange('auto_start_monitoring', !settings.auto_start_monitoring)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        settings.auto_start_monitoring ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Layar Penuh</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Tampilkan monitoring dalam mode fullscreen</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.start_fullscreen}
                      onClick={() => handleSettingChange('start_fullscreen', !settings.start_fullscreen)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        settings.start_fullscreen ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Animasi Transisi</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Efek geser halus saat pergantian slide</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.slide_animation !== false}
                      onClick={() => handleSettingChange('slide_animation', settings.slide_animation === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        settings.slide_animation !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          settings.slide_animation !== false ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Windows Auto-Start */}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Auto-Start Windows</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Jalankan aplikasi saat komputer dinyalakan atau login</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!settings.launch_on_startup}
                      onClick={() => handleSettingChange('launch_on_startup', !settings.launch_on_startup)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        settings.launch_on_startup ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Abaikan Sertifikat SSL (HTTPS IP)</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Izinkan membuka web IP dengan sertifikat self-signed (seperti Cockpit, Proxmox, Zabbix)</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.ignore_certificate_errors !== false}
                      onClick={() => handleSettingChange('ignore_certificate_errors', settings.ignore_certificate_errors === false)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                        settings.ignore_certificate_errors !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
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

                {/* Duration & Idle inputs */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="idle_timeout" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Lanjut Rotasi
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="idle_timeout"
                        type="number"
                        min="5"
                        max="600"
                        value={settings.idle_timeout_seconds}
                        onChange={(e) => handleSettingChange('idle_timeout_seconds', parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pr-12 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 text-[11px] text-slate-400 pointer-events-none">dtk</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Setelah cursor diam</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="default_duration" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Durasi Slide
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="default_duration"
                        type="number"
                        min="3"
                        max="3600"
                        value={settings.default_duration}
                        onChange={(e) => handleSettingChange('default_duration', parseInt(e.target.value, 10) || 15)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 pr-12 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 text-[11px] text-slate-400 pointer-events-none">dtk</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Waktu tayang default</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Kiosk & Profil Sesi */}
            {settingsTab === 'kiosk_session' && (
              <div className="flex flex-col gap-4">
                {/* Kiosk Mode Box */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Mode Kiosk 24 Jam</span>
                    <button
                      type="button"
                      onClick={() => setIsKioskModalOpen(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                    >
                      Panduan Lengkap
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Menjalankan layar monitor TV atau NOC otomatis tanpa intervensi operator saat PC restart atau mati listrik.
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span>Auto-Start saat Login:</span>
                      <span className={`font-semibold ${settings.launch_on_startup ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {settings.launch_on_startup ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Metode Layanan:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Task Scheduler
                      </span>
                    </div>
                  </div>

                  <div className="relative group mt-0.5">
                    <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-200 text-[10px] overflow-x-auto border border-slate-800 leading-tight">
                      {kioskInstallCmd}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(kioskInstallCmd);
                        setCopiedScriptNotice(true);
                        setTimeout(() => setCopiedScriptNotice(false), 3000);
                      }}
                      className="absolute right-1.5 top-1.5 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium border border-slate-700 transition cursor-pointer"
                    >
                      {copiedScriptNotice ? 'Tersalin!' : 'Salin Perintah'}
                    </button>
                  </div>
                </div>

                {/* Session Profile Management */}
                <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Profil Sesi & Cookie</span>
                    <span className="text-[10px] text-slate-400">{availableProfiles.length} profil</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Slide dengan profil yang sama berbagi sesi login. Gunakan profil berbeda jika perlu multi-akun pada alamat yang sama.
                  </p>

                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {availableProfiles.map(([profName, count]) => (
                      <div
                        key={profName}
                        className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {profName}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {count} slide
                          </span>
                        </div>

                        {confirmClearProfile === profName ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleClearSession(profName)}
                              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold transition cursor-pointer"
                            >
                              Ya, Reset
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearProfile(null)}
                              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] transition cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmClearProfile(profName)}
                            className="text-[11px] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium transition cursor-pointer"
                          >
                            Reset Cookie
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
                      placeholder="Hapus cookie profil lain..."
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      disabled={!customClearProfile.trim()}
                      onClick={() => handleClearSession(customClearProfile)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 transition cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  {sessionClearNotice && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{sessionClearNotice}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Slide Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingSlide ? 'Edit Website' : 'Tambah Website'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
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
                  Nama Website
                </label>
                <input
                  id="modal_name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Grafana NOC atau Server 10.6.3.120"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="modal_url" className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  URL atau Alamat IP Lengkap
                </label>
                <div className="flex gap-2">
                  <input
                    id="modal_url"
                    type="text"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="http://10.6.3.120:3003 atau https://zabbix.local"
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestUrlFromModal}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition shrink-0 cursor-pointer"
                  >
                    Uji Buka
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Durasi tayang slide:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {settings.default_duration} detik (sesuai pengaturan)
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.keep_alive}
                    onChange={(e) => setFormData({ ...formData, keep_alive: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Tetap aktif di latar belakang (Keep Alive)</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Proses browser tidak dibekukan saat slide berganti. Cocok untuk dashboard dengan grafik real-time atau koneksi WebSocket.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Aktifkan dalam rotasi slide</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition cursor-pointer"
                >
                  Simpan Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <Logo size={22} variant="mark-gradient" className="shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pintasan Keyboard</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
              <div className="flex items-center justify-between text-xs py-1.5">
                <kbd className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                  Spasi
                </kbd>
                <span className="text-xs text-slate-600 dark:text-slate-400">Jeda atau lanjut rotasi</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    ←
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    →
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">Pindah slide sebelumnya atau berikutnya</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    F5
                  </kbd>
                  <span className="text-slate-400 text-[10px]">/</span>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    Ctrl+R
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">Muat ulang halaman aktif</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    F11
                  </kbd>
                  <span className="text-slate-400 text-[10px]">/</span>
                  <kbd className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                    Esc
                  </kbd>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">Masuk atau keluar layar penuh</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5">
                <kbd className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded shadow-2xs">
                  Alt+S
                </kbd>
                <span className="text-xs text-slate-600 dark:text-slate-400">Buka menu pengaturan</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kiosk 24 Jam Guide Modal */}
      {isKioskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <Logo size={28} variant="mark-gradient" className="shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Panduan Kiosk 24 Jam Windows
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsKioskModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Mengapa tidak memakai Windows Service murni?</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Windows Service berjalan di <strong>Session 0</strong> tanpa antarmuka grafis. Jika aplikasi visual dijalankan sebagai service murni, proses aktif di latar belakang namun layar fisik TV tidak akan menampilkan visual. Agar display menyala otomatis tanpa intervensi, gunakan <strong>Windows Auto-Logon</strong> digabung dengan <strong>Auto-Start</strong> atau <strong>Task Scheduler</strong>.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-100">Tahap Konfigurasi:</span>
                <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-400">
                  <li>
                    Di tab <strong>Preferensi</strong>, nyalakan toggle <strong>Auto-Start Windows</strong>, <strong>Layar Penuh</strong>, dan <strong>Auto-start Monitoring</strong>.
                  </li>
                  <li>
                    Atur <strong>Windows Auto-Logon</strong> agar PC otomatis masuk ke desktop tanpa meminta password saat restart atau setelah pemadaman listrik:
                    <div className="mt-1 p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-200">
                      Tekan Win + R, ketik <code>netplwiz</code>, hapus centang "Users must enter a user name and password", lalu klik OK.
                    </div>
                  </li>
                </ol>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-100">Opsi Tambahan: Pasang Lewat Task Scheduler</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Script ini mendaftarkan aplikasi ke Task Scheduler Windows dengan hak akses tertinggi tanpa memunculkan prompt konfirmasi UAC:
                </p>

                <div className="relative group">
                  <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 text-[11px] overflow-x-auto border border-slate-800">
                    {kioskInstallCmd}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(kioskInstallCmd);
                      setCopiedScriptNotice(true);
                      setTimeout(() => setCopiedScriptNotice(false), 3000);
                    }}
                    className="absolute right-2 top-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition cursor-pointer"
                  >
                    {copiedScriptNotice ? 'Tersalin!' : 'Salin Perintah'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsKioskModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
