import React, { useState, useEffect } from 'react';
import { WebsiteSlide, AppSettings } from '../../types';

interface SettingsPageProps {
  onStartMonitoring: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onStartMonitoring }) => {
  const [websites, setWebsites] = useState<WebsiteSlide[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    auto_start_monitoring: true,
    idle_timeout_seconds: 30,
    default_duration: 15,
    start_fullscreen: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<WebsiteSlide | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    duration: 15,
    session_profile: 'default',
    keep_alive: false,
    is_active: true
  });

  const [sessionToClear, setSessionToClear] = useState('default');
  const [sessionClearNotice, setSessionClearNotice] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedWebsites, loadedSettings] = await Promise.all([
        window.monitorAPI.getWebsites(),
        window.monitorAPI.getSettings()
      ]);
      setWebsites(loadedWebsites);
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setIsLoading(false);
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
      session_profile: slide.session_profile,
      keep_alive: slide.keep_alive,
      is_active: slide.is_active
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const trimmedName = formData.name.trim();
    let normalizedUrl = formData.url.trim();

    if (!trimmedName) {
      setFormError('Nama website wajib diisi.');
      return;
    }

    if (!normalizedUrl) {
      setFormError('URL atau IP website wajib diisi.');
      return;
    }

    // Auto-prepend http:// if user entered raw IP or host without protocol (e.g. 192.168.1.1 or 10.0.0.5:8080)
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'http://' + normalizedUrl;
    }

    try {
      const parsed = new URL(normalizedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setFormError('URL harus menggunakan protokol http:// atau https://');
        return;
      }
    } catch {
      setFormError('Format URL atau IP tidak valid. Contoh: http://192.168.1.1 atau https://zabbix.local');
      return;
    }

    const durationNum = Number(formData.duration);
    if (isNaN(durationNum) || durationNum < 3) {
      setFormError('Durasi minimal adalah 3 detik.');
      return;
    }

    const slideToSave = {
      id: editingSlide ? editingSlide.id : `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      url: normalizedUrl,
      duration: durationNum,
      sort_order: editingSlide ? editingSlide.sort_order : websites.length,
      is_active: formData.is_active,
      keep_alive: formData.keep_alive,
      session_profile: formData.session_profile.trim() || 'default'
    };

    try {
      await window.monitorAPI.saveWebsite(slideToSave);
      setIsFormOpen(false);
      await loadData();
    } catch (error) {
      setFormError('Gagal menyimpan website. Silakan coba lagi.');
      console.error(error);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus website ini dari daftar monitoring?')) {
      await window.monitorAPI.deleteWebsite(id);
      await loadData();
    }
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
  };

  const handleClearSession = async () => {
    if (window.confirm(`Hapus seluruh cookies dan data login untuk profil sesi "${sessionToClear}"?`)) {
      await window.monitorAPI.clearSessionProfile(sessionToClear);
      setSessionClearNotice(`Sesi "${sessionToClear}" berhasil dibersihkan.`);
      setTimeout(() => setSessionClearNotice(null), 4000);
    }
  };

  const activeWebsitesCount = websites.filter((w) => w.is_active).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            M
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">MonitorSlide</h1>
            <p className="text-[11px] text-slate-400">Pengaturan Slideshow Monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onStartMonitoring}
            disabled={activeWebsitesCount === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg transition ${
              activeWebsitesCount > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white cursor-pointer shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
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
              <h2 className="text-lg font-bold text-slate-100">Daftar Website</h2>
              <p className="text-xs text-slate-400">Website akan ditampilkan berurutan sesuai daftar ini</p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Tambah Website</span>
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500 text-sm">Memuat konfigurasi...</div>
          ) : websites.length === 0 ? (
            <div className="p-10 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-900/30 flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Belum Ada Website Ditambahkan</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Tambahkan URL dashboard Zabbix atau sistem monitoring internal Anda untuk memulai slideshow.
              </p>
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
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
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-900 opacity-60'
                  }`}
                >
                  {/* Order & Reorder Controls */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs font-mono font-bold text-slate-500">
                      #{index + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 'up')}
                        disabled={index === 0}
                        title="Geser Naik"
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 transition"
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
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Website Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-100 truncate">
                        {slide.name}
                      </h3>
                      {slide.keep_alive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          Real-time
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                        {slide.session_profile}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate" title={slide.url}>
                      {slide.url}
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 rounded-lg">
                      {slide.duration} detik
                    </span>
                  </div>

                  {/* Status Toggle & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(slide)}
                      title={slide.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                        slide.is_active ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                          slide.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditForm(slide)}
                      title="Edit"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(slide.id)}
                      title="Hapus"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Preferences & Sessions (1 Col) */}
        <aside className="flex flex-col gap-6">
          {/* General Preferences */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-100">Preferensi Monitoring</h2>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/80">
              <div>
                <div className="text-xs font-semibold text-slate-200">Auto-start Monitoring</div>
                <div className="text-[11px] text-slate-400">Mulai slideshow otomatis saat aplikasi dibuka</div>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_start_monitoring}
                onChange={(e) => handleSettingChange('auto_start_monitoring', e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/80">
              <div>
                <div className="text-xs font-semibold text-slate-200">Mulai Layar Penuh</div>
                <div className="text-[11px] text-slate-400">Buka langsung dalam mode fullscreen</div>
              </div>
              <input
                type="checkbox"
                checked={settings.start_fullscreen}
                onChange={(e) => handleSettingChange('start_fullscreen', e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 py-1">
              <label htmlFor="idle_timeout" className="text-xs font-semibold text-slate-200">
                Waktu Idle Auto-Resume (Detik)
              </label>
              <div className="text-[11px] text-slate-400 mb-1">
                Lanjut slideshow otomatis setelah operator selesai beraktivitas
              </div>
              <input
                id="idle_timeout"
                type="number"
                min="5"
                max="300"
                value={settings.idle_timeout_seconds}
                onChange={(e) => handleSettingChange('idle_timeout_seconds', parseInt(e.target.value, 10) || 30)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Session Profile Management */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-100">Manajemen Sesi Login</h2>
            <p className="text-xs text-slate-400">
              Cookies dan data sesi disimpan secara persisten di partisi profil browser.
            </p>

            <div className="flex flex-col gap-2">
              <label htmlFor="session_profile" className="text-xs font-medium text-slate-300">
                Pilih Profil Sesi untuk Dibersihkan:
              </label>
              <input
                id="session_profile"
                type="text"
                value={sessionToClear}
                onChange={(e) => setSessionToClear(e.target.value)}
                placeholder="default / noc-1"
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleClearSession}
                className="mt-1 py-2 px-3 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-medium transition"
              >
                Hapus Sesi Profil Ini
              </button>
              {sessionClearNotice && (
                <div className="text-[11px] text-emerald-400 mt-1">{sessionClearNotice}</div>
              )}
            </div>
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 text-xs text-slate-400">
            <h3 className="font-semibold text-slate-300 mb-2">Pintasan Keyboard (Monitoring):</h3>
            <ul className="flex flex-col gap-1.5 font-mono text-[11px]">
              <li><span className="text-slate-200">Spasi</span> : Jeda / Lanjutkan</li>
              <li><span className="text-slate-200">Panah Kiri/Kanan</span> : Slide Sebelumnya/Berikutnya</li>
              <li><span className="text-slate-200">F5</span> : Muat ulang website aktif</li>
              <li><span className="text-slate-200">F11 / Esc</span> : Layar Penuh / Keluar</li>
              <li><span className="text-slate-200">S</span> : Kembali ke Pengaturan ini</li>
            </ul>
          </div>
        </aside>
      </main>

      {/* Slide Add/Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h2 className="text-base font-bold text-slate-100">
                {editingSlide ? 'Edit Website' : 'Tambah Website Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSlide} className="flex flex-col gap-4">
              <div>
                <label htmlFor="modal_name" className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Tampilan
                </label>
                <input
                  id="modal_name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Zabbix Server Core"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="modal_url" className="block text-xs font-semibold text-slate-300 mb-1">
                  URL atau Alamat IP
                </label>
                <input
                  id="modal_url"
                  type="text"
                  required
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="Contoh: 192.168.1.1 atau http://10.98.69.62:3000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal_duration" className="block text-xs font-semibold text-slate-300 mb-1">
                    Durasi Tampil (Detik)
                  </label>
                  <input
                    id="modal_duration"
                    type="number"
                    min="3"
                    max="3600"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value, 10) || 15 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="modal_profile" className="block text-xs font-semibold text-slate-300 mb-1">
                    Profil Sesi Browser
                  </label>
                  <input
                    id="modal_profile"
                    type="text"
                    value={formData.session_profile}
                    onChange={(e) => setFormData({ ...formData, session_profile: e.target.value })}
                    placeholder="default"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.keep_alive}
                    onChange={(e) => setFormData({ ...formData, keep_alive: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200">Keep Alive (Real-time Background)</span>
                    <p className="text-[11px] text-slate-400">
                      Jangan bekukan view ini saat slide lain aktif (untuk dashboard WebSocket langsung)
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-200">Slide Aktif dalam Slideshow</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition"
                >
                  Simpan Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
