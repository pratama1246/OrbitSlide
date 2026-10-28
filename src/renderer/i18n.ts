export type AppLanguage = 'id' | 'en';

const INDONESIAN_TIMEZONES = new Set([
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Makassar',
  'Asia/Ujung_Pandang',
  'Asia/Jayapura'
]);

export function detectDefaultLanguage(): AppLanguage {
  try {
    const navLangs = typeof navigator !== 'undefined'
      ? (navigator.languages?.length ? navigator.languages : [navigator.language])
      : [];
    for (const raw of navLangs) {
      const lang = (raw || '').toLowerCase();
      if (
        lang === 'id' ||
        lang.startsWith('id-') ||
        lang.startsWith('id_') ||
        lang.endsWith('-id') ||
        lang.endsWith('_id')
      ) {
        return 'id';
      }
    }

    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const intlLocale = (resolved.locale || '').toLowerCase();
    if (
      intlLocale === 'id' ||
      intlLocale.startsWith('id-') ||
      intlLocale.startsWith('id_') ||
      intlLocale.endsWith('-id') ||
      intlLocale.endsWith('_id')
    ) {
      return 'id';
    }

    if (resolved.timeZone && INDONESIAN_TIMEZONES.has(resolved.timeZone)) {
      return 'id';
    }
  } catch {
    // Fallback to English if detection fails
  }
  return 'en';
}

export const translations = {
  id: {
    // Header & General
    appName: 'OrbitSlide',
    shortcuts: 'Pintasan',
    shortcutsTooltip: 'Lihat daftar pintasan keyboard',
    addWebsite: 'Tambah Website',
    startMonitoring: 'Mulai Monitoring',
    loadingConfig: 'Memuat konfigurasi...',
    close: 'Tutup',
    cancel: 'Batal',
    delete: 'Hapus',
    edit: 'Edit Slide',
    saveWebsite: 'Simpan Website',
    systemBuiltIn: 'Bawaan Sistem',
    systemBuiltInTooltip: 'Slide bawaan sistem tidak dapat dihapus, gunakan toggle untuk menonaktifkan',
    standbyDefaultName: 'Layar Standby',

    // Website List Section
    websiteListTitle: 'Daftar Website',
    websiteListSub: 'Pilih "Uji / Login" untuk masuk ke akun atau memeriksa tampilan sebelum rotasi dimulai.',
    emptyTitle: 'Belum ada website',
    emptySub: 'Tambahkan tautan atau alamat IP lokal dashboard untuk ditampilkan secara berurutan.',
    addFirstWebsite: 'Tambah Website Pertama',
    dragToReorder: 'Tahan dan geser untuk memindah urutan',
    moveUp: 'Geser Naik',
    moveDown: 'Geser Turun',
    preview: 'Pratinjau',
    previewTooltip: 'Pratinjau Layar Standby',
    testLogin: 'Uji / Login',
    testLoginTooltip: 'Buka website untuk uji koneksi atau login akun',
    disableSlide: 'Nonaktifkan slide',
    enableSlide: 'Aktifkan slide',
    deleteSlideTooltip: 'Hapus Slide',
    sessionBadge: 'Sesi',

    // Status Badges
    statusConnected: 'Terhubung',
    statusLoading: 'Memuat...',
    statusFailed: 'Gagal Dimuat',
    statusActive: 'Aktif',

    // Standby Descriptions
    standbyCustomCount: (count: number) => `Wallpaper Upload: ${count} gambar`,
    standbyPresetPrefix: 'Wallpaper',
    presetSolid: 'Warna Solid',
    presetSolidDesc: 'Latar gelap minimalis',
    solidColorLabel: 'Pilihan Warna Latar',
    solidColorDesc: 'Pilih warna solid untuk layar standby',
    presetCustom: 'Upload Gambar PC',
    presetCustomDesc: 'Bebas ukuran & maks. 3 gambar',

    // Right Sidebar Tabs & Preferences
    tabPreferences: 'Preferensi',
    tabStandby: 'Layar Standby',
    tabSessionCookie: 'Sesi & Cookie',
    standbyRotationToggle: 'Sertakan dalam rotasi slide',
    standbyRotationDesc: 'Tampilkan layar standby secara bergantian di antara rotasi website',
    languageLabel: 'Bahasa / Language',
    themeLabel: 'Tema Tampilan',
    themeLight: 'Terang',
    themeDark: 'Gelap',
    themeSystem: 'Sistem',
    autoStartTitle: 'Auto-start Monitoring',
    autoStartDesc: 'Putar rotasi slide langsung saat aplikasi dibuka',
    fullscreenTitle: 'Layar Penuh',
    fullscreenDesc: 'Tampilkan monitoring dalam mode fullscreen',
    slideAnimTitle: 'Animasi Transisi',
    slideAnimDesc: 'Efek geser halus saat pergantian slide',
    winAutoStartTitle: 'Auto-Start Windows',
    winAutoStartDesc: 'Jalankan aplikasi saat komputer dinyalakan atau login',
    ignoreSslTitle: 'Abaikan Sertifikat SSL',
    ignoreSslDesc: 'Izinkan membuka alamat HTTPS lokal dengan sertifikat self-signed',
    resumeRotationLabel: 'Lanjut Rotasi',
    afterCursorIdle: 'Setelah kursor diam',
    slideDurationLabel: 'Durasi Slide',
    defaultDisplayTime: 'Waktu tayang default',
    secondsShort: 'dtk',

    // Session & Cookie Tab
    sessionProfileTitle: 'Profil Sesi & Cookie',
    profileCount: (count: number) => `${count} profil`,
    slideCount: (count: number) => `${count} slide`,
    sessionProfileDesc: 'Slide dengan profil yang sama berbagi sesi login. Gunakan profil berbeda jika perlu multi-akun pada alamat yang sama.',
    confirmReset: 'Ya, Reset',
    resetCookie: 'Reset Cookie',
    clearOtherProfilePlaceholder: 'Hapus cookie profil lain...',
    resetBtn: 'Reset',
    sessionClearedNotice: (profile: string) => `Data sesi dan cookie profil "${profile}" berhasil dihapus.`,

    // Footer & About
    aboutApp: 'Tentang Aplikasi',
    allRightsReserved: '© 2026 OrbitSlide. Hak cipta dilindungi.',
    aboutDescription: 'Aplikasi display dan rotasi website otomatis untuk ruang kontrol operasional, NOC, dan wallboard display.',
    appVersion: 'Versi Aplikasi:',
    osLabel: 'Sistem Operasi:',
    loadingText: 'Memuat...',
    copied: 'Tersalin!',
    copyInfo: 'Salin Info',
    termsShort: 'S&K',
    privacyShort: 'Privasi',
    mitLicense: 'Lisensi MIT',
    lastUpdated: 'Terakhir diperbarui: 26 Oktober 2026',

    // Add / Edit Modal
    modalStandbyTitle: 'Pengaturan Layar Standby',
    modalEditTitle: 'Edit Website',
    modalAddTitle: 'Tambah Website',
    slideNameLabel: 'Nama Tampilan / Slide',
    slideNamePlaceholder: 'Contoh: Layar Standby atau Grafana NOC',
    wallpaperThemeLabel: 'Tema Wallpaper Lock Screen',
    previewFullscreen: 'Pratinjau Layar Penuh',
    wallpaperHeader: 'Wallpaper',
    wallpaperMaxHint: 'Maksimal 3 gambar untuk rotasi bergantian',
    deleteAll: 'Hapus Semua',
    deleteAllTooltip: 'Hapus semua gambar',
    uploadBtn: 'Upload',
    max3Badge: 'Maks. 3',
    noWallpaperUploaded: 'Belum ada gambar yang di-upload. Klik "Upload" untuk memilih dari komputer.',
    deleteThisImage: 'Hapus gambar ini',
    urlOrIpLabel: 'URL atau Alamat IP Lengkap',
    urlPlaceholder: 'http://10.6.3.120:3003 atau https://zabbix.local',
    testOpenBtn: 'Uji Buka',

    // Slide Refresh Mode
    reloadModeLabel: 'Mode Refresh / Muat Ulang Halaman',
    reloadModeStandby: 'Standby di Background (Live / Tanpa Reload)',
    reloadModeEveryTurn: 'Refresh Setiap Giliran Tampil',
    reloadMode5m: 'Refresh Tiap 5 Menit',
    reloadMode15m: 'Refresh Tiap 15 Menit',
    reloadMode30m: 'Refresh Tiap 30 Menit',
    reloadMode60m: 'Refresh Tiap 1 Jam',
    reloadModeStandbyDesc: 'Halaman tetap aktif di memori tanpa jeda reload. Cocok untuk dashboard realtime, Grafana, CCTV, atau aplikasi live.',
    reloadModeEveryTurnDesc: 'Halaman otomatis di-refresh dari awal setiap kali giliran slide ini muncul. Cocok untuk portal berita & laporan statis.',
    reloadModeIntervalDesc: 'Halaman otomatis di-refresh jika sudah melewati interval waktu yang ditentukan saat giliran tayang.',
    reloadBadgeStandbyTitle: 'Mode Standby / Live (tanpa reload)',
    reloadBadgeEveryTurn: 'Tiap Giliran',
    reloadBadgeEveryTurnTitle: 'Di-refresh setiap giliran tayang',
    reloadBadgeIntervalTitle: (m: number) => `Di-refresh berkala tiap ${m} menit`,

    // Validation Errors
    errNameRequired: 'Nama tampilan wajib diisi.',
    errUrlRequired: 'URL atau alamat IP website wajib diisi.',
    errUrlProtocol: 'URL harus menggunakan protokol http:// atau https://',
    errUrlHost: 'Hostname atau alamat IP tidak valid.',
    errUrlFormat: 'Format URL atau IP tidak valid. Contoh: http://10.6.3.120:3003',
    errCustomWallpaperEmpty: 'Silakan upload minimal 1 gambar wallpaper terlebih dahulu, atau pilih tema bawaan.',
    errSaveFailed: 'Gagal menyimpan website',
    errInvalidTestUrl: 'URL tidak valid untuk diuji.',

    // Shortcuts Modal
    shortcutsModalTitle: 'Pintasan Keyboard',
    keySpace: 'Spasi',
    scPlayPause: 'Jeda atau lanjutkan rotasi',
    scPrevNext: 'Pindah slide sebelumnya atau berikutnya',
    scReload: 'Muat ulang halaman aktif',
    scFullscreen: 'Masuk atau keluar layar penuh',
    scSettings: 'Buka menu pengaturan',

    // Floating HUD
    hudWakeTooltip: 'Arahkan kursor ke atas untuk menampilkan kontrol',
    hudClickToSelect: 'Klik untuk memilih slide',
    hudSelectSlide: 'Pilih Slide',
    hudActiveCount: (count: number) => `${count} aktif`,
    hudDragHint: 'Tarik untuk atur urutan',
    hudPrevTooltip: 'Slide Sebelumnya (Panah Kiri)',
    hudPlayTooltip: 'Lanjutkan Slideshow (Spasi)',
    hudPauseTooltip: 'Jeda Slideshow (Spasi)',
    hudNextTooltip: 'Slide Berikutnya (Panah Kanan)',
    hudReloadTooltip: 'Muat Ulang Halaman (F5)',
    hudExitFullscreenTooltip: 'Keluar Layar Penuh (F11 / Esc)',
    hudEnterFullscreenTooltip: 'Layar Penuh (F11)',
    hudSettingsTooltip: 'Kembali ke Pengaturan (Alt+S)',
    hudStandbySub: 'Lock Screen • Jam & Tanggal',

    // Popup Modal
    popupStandbyPreview: 'Pratinjau Layar Standby',
    popupWindow: 'Jendela Popup',
    popupTestLogin: 'Uji & Login Sesi',
    popupProfileBadge: 'Profil',
    popupCloseTooltip: 'Tutup Jendela',

    // Slide Error Fallback
    errFallbackTitle: 'Gagal Memuat Website',
    errFallbackDefaultSlide: 'Slide Monitoring',
    errAutoRetry: (retry: number) => `Percobaan Pemulihan Otomatis: ${retry} / 3`,
    errDefaultReason: 'Koneksi terputus atau server tidak merespons.',
    reloadBtn: 'Muat Ulang',
    skipBtn: 'Lewati',

    // Legal Modal Titles
    legalTermsTitle: 'Syarat dan Ketentuan Penggunaan',
    legalPrivacyTitle: 'Kebijakan Privasi',
    legalLicenseTitle: 'Lisensi Perangkat Lunak MIT',
    legalTermsTab: 'Syarat & Ketentuan',
    legalPrivacyTab: 'Kebijakan Privasi',
    legalLicenseTab: 'Lisensi MIT'
  },
  en: {
    // Header & General
    appName: 'OrbitSlide',
    shortcuts: 'Shortcuts',
    shortcutsTooltip: 'View keyboard shortcuts',
    addWebsite: 'Add Website',
    startMonitoring: 'Start Monitoring',
    loadingConfig: 'Loading configuration...',
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit Slide',
    saveWebsite: 'Save Website',
    systemBuiltIn: 'System Built-in',
    systemBuiltInTooltip: 'System default slide cannot be deleted, use the toggle to disable it',
    standbyDefaultName: 'Standby Screen',

    // Website List Section
    websiteListTitle: 'Website List',
    websiteListSub: 'Click "Test / Login" to sign in or verify the page before starting rotation.',
    emptyTitle: 'No websites yet',
    emptySub: 'Add a dashboard URL or local IP address to display in rotation.',
    addFirstWebsite: 'Add First Website',
    dragToReorder: 'Hold and drag to reorder',
    moveUp: 'Move Up',
    moveDown: 'Move Down',
    preview: 'Preview',
    previewTooltip: 'Preview Standby Screen',
    testLogin: 'Test / Login',
    testLoginTooltip: 'Open website to test connection or sign in',
    disableSlide: 'Disable slide',
    enableSlide: 'Enable slide',
    deleteSlideTooltip: 'Delete Slide',
    sessionBadge: 'Session',

    // Status Badges
    statusConnected: 'Connected',
    statusLoading: 'Loading...',
    statusFailed: 'Load Failed',
    statusActive: 'Active',

    // Standby Descriptions
    standbyCustomCount: (count: number) => `Uploaded Wallpaper: ${count} ${count === 1 ? 'image' : 'images'}`,
    standbyPresetPrefix: 'Wallpaper',
    presetSolid: 'Solid Dark Color',
    presetSolidDesc: 'Clean dark background',
    solidColorLabel: 'Solid Background Color',
    solidColorDesc: 'Choose a custom solid background color',
    presetCustom: 'Upload PC Images',
    presetCustomDesc: 'Any resolution, up to 3 images',

    // Right Sidebar Tabs & Preferences
    tabPreferences: 'Preferences',
    tabStandby: 'Standby Screen',
    tabSessionCookie: 'Session & Cookies',
    standbyRotationToggle: 'Include in slide rotation',
    standbyRotationDesc: 'Display the standby screen periodically during website rotation',
    languageLabel: 'Language / Bahasa',
    themeLabel: 'Appearance Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    autoStartTitle: 'Auto-start Monitoring',
    autoStartDesc: 'Start slide rotation immediately when the app launches',
    fullscreenTitle: 'Fullscreen Mode',
    fullscreenDesc: 'Launch monitoring display in fullscreen mode',
    slideAnimTitle: 'Slide Transition',
    slideAnimDesc: 'Smooth sliding animation when switching slides',
    winAutoStartTitle: 'Windows Auto-Start',
    winAutoStartDesc: 'Launch application automatically when Windows starts or logs in',
    ignoreSslTitle: 'Ignore SSL Errors',
    ignoreSslDesc: 'Allow local HTTPS dashboards with self-signed certificates',
    resumeRotationLabel: 'Resume Rotation',
    afterCursorIdle: 'After cursor is idle',
    slideDurationLabel: 'Slide Duration',
    defaultDisplayTime: 'Default display time',
    secondsShort: 'sec',

    // Session & Cookie Tab
    sessionProfileTitle: 'Session & Cookie Profiles',
    profileCount: (count: number) => `${count} ${count === 1 ? 'profile' : 'profiles'}`,
    slideCount: (count: number) => `${count} ${count === 1 ? 'slide' : 'slides'}`,
    sessionProfileDesc: 'Slides with the same profile share login sessions. Use separate profiles for multiple accounts on the same domain.',
    confirmReset: 'Yes, Reset',
    resetCookie: 'Reset Cookies',
    clearOtherProfilePlaceholder: 'Clear another profile...',
    resetBtn: 'Reset',
    sessionClearedNotice: (profile: string) => `Session data and cookies for profile "${profile}" have been cleared.`,

    // Footer & About
    aboutApp: 'About Application',
    allRightsReserved: '© 2026 OrbitSlide. All rights reserved.',
    aboutDescription: 'Automated multi-website display and rotation utility for NOC control rooms and wallboard screens.',
    appVersion: 'App Version:',
    osLabel: 'Operating System:',
    loadingText: 'Loading...',
    copied: 'Copied!',
    copyInfo: 'Copy Info',
    termsShort: 'Terms',
    privacyShort: 'Privacy',
    mitLicense: 'MIT License',
    lastUpdated: 'Last updated: October 26, 2026',

    // Add / Edit Modal
    modalStandbyTitle: 'Standby Screen Settings',
    modalEditTitle: 'Edit Website',
    modalAddTitle: 'Add Website',
    slideNameLabel: 'Display / Slide Name',
    slideNamePlaceholder: 'Example: Standby Screen or Grafana NOC',
    wallpaperThemeLabel: 'Lock Screen Wallpaper Theme',
    previewFullscreen: 'Fullscreen Preview',
    wallpaperHeader: 'Wallpaper',
    wallpaperMaxHint: 'Maximum 3 images for alternating rotation',
    deleteAll: 'Delete All',
    deleteAllTooltip: 'Delete all images',
    uploadBtn: 'Upload',
    max3Badge: 'Max 3',
    noWallpaperUploaded: 'No images uploaded yet. Click "Upload" to choose from your computer.',
    deleteThisImage: 'Delete this image',
    urlOrIpLabel: 'Full URL or IP Address',
    urlPlaceholder: 'http://10.6.3.120:3003 or https://zabbix.local',
    testOpenBtn: 'Test Open',

    // Slide Refresh Mode
    reloadModeLabel: 'Page Refresh Mode',
    reloadModeStandby: 'Standby in Background (Live / No Reload)',
    reloadModeEveryTurn: 'Refresh on Every Turn',
    reloadMode5m: 'Refresh Every 5 Minutes',
    reloadMode15m: 'Refresh Every 15 Minutes',
    reloadMode30m: 'Refresh Every 30 Minutes',
    reloadMode60m: 'Refresh Every 1 Hour',
    reloadModeStandbyDesc: 'Page stays live in memory with zero reload delays. Best for realtime dashboards, Grafana, CCTV, or live apps.',
    reloadModeEveryTurnDesc: 'Page automatically reloads every time this slide appears. Best for static news, sheets, or intranet portals.',
    reloadModeIntervalDesc: 'Page automatically reloads once the specified time interval has elapsed when it appears.',
    reloadBadgeStandbyTitle: 'Standby / Live mode (no reload)',
    reloadBadgeEveryTurn: 'Every Turn',
    reloadBadgeEveryTurnTitle: 'Refreshed on every appearance',
    reloadBadgeIntervalTitle: (m: number) => `Refreshed periodically every ${m} minutes`,

    // Validation Errors
    errNameRequired: 'Display name is required.',
    errUrlRequired: 'Website URL or IP address is required.',
    errUrlProtocol: 'URL must use http:// or https:// protocol',
    errUrlHost: 'Invalid hostname or IP address.',
    errUrlFormat: 'Invalid URL or IP format. Example: http://10.6.3.120:3003',
    errCustomWallpaperEmpty: 'Please upload at least 1 wallpaper image first, or choose a built-in theme.',
    errSaveFailed: 'Failed to save website',
    errInvalidTestUrl: 'Invalid URL to test.',

    // Shortcuts Modal
    shortcutsModalTitle: 'Keyboard Shortcuts',
    keySpace: 'Space',
    scPlayPause: 'Pause or resume slide rotation',
    scPrevNext: 'Previous or next slide',
    scReload: 'Reload active page',
    scFullscreen: 'Toggle fullscreen mode',
    scSettings: 'Open settings menu',

    // Floating HUD
    hudWakeTooltip: 'Move cursor to top edge to show controls',
    hudClickToSelect: 'Click to select slide',
    hudSelectSlide: 'Select Slide',
    hudActiveCount: (count: number) => `${count} active`,
    hudDragHint: 'Drag to reorder',
    hudPrevTooltip: 'Previous Slide (Left Arrow)',
    hudPlayTooltip: 'Resume Slideshow (Space)',
    hudPauseTooltip: 'Pause Slideshow (Space)',
    hudNextTooltip: 'Next Slide (Right Arrow)',
    hudReloadTooltip: 'Reload Page (F5)',
    hudExitFullscreenTooltip: 'Exit Fullscreen (F11 / Esc)',
    hudEnterFullscreenTooltip: 'Fullscreen (F11)',
    hudSettingsTooltip: 'Back to Settings (Alt+S)',
    hudStandbySub: 'Lock Screen • Clock & Date',

    // Popup Modal
    popupStandbyPreview: 'Standby Screen Preview',
    popupWindow: 'Popup Window',
    popupTestLogin: 'Test & Session Login',
    popupProfileBadge: 'Profile',
    popupCloseTooltip: 'Close Window',

    // Slide Error Fallback
    errFallbackTitle: 'Failed to Load Website',
    errFallbackDefaultSlide: 'Monitoring Slide',
    errAutoRetry: (retry: number) => `Automatic Recovery Attempt: ${retry} / 3`,
    errDefaultReason: 'Connection lost or server did not respond.',
    reloadBtn: 'Reload',
    skipBtn: 'Skip',

    // Legal Modal Titles
    legalTermsTitle: 'Terms and Conditions of Use',
    legalPrivacyTitle: 'Privacy Policy',
    legalLicenseTitle: 'MIT Software License',
    legalTermsTab: 'Terms of Use',
    legalPrivacyTab: 'Privacy Policy',
    legalLicenseTab: 'MIT License'
  }
} as const;

export function getTranslations(lang?: AppLanguage) {
  return translations[lang === 'en' ? 'en' : 'id'];
}
