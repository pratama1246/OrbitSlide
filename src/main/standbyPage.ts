import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import { WebsiteSlide, StandbyWallpaperItem } from '../types';

const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.avif']);

function getPrimaryLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;
    for (const item of list) {
      if (item.family === 'IPv4' && !item.internal) {
        return item.address;
      }
    }
  }
  return '127.0.0.1';
}

export function getWallpapersDir(): string {
  const dir = path.join(app.getPath('userData'), 'wallpapers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function listStandbyWallpapers(): StandbyWallpaperItem[] {
  const dir = getWallpapersDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const items: StandbyWallpaperItem[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext)) continue;
    const fullPath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      items.push({
        fileName: entry.name,
        filePath: fullPath,
        fileUrl: pathToFileURL(fullPath).href,
        sizeBytes: stat.size
      });
    } catch {}
  }

  return items.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

const MAX_STANDBY_WALLPAPERS = 3;

export function addStandbyWallpapersFromPaths(sourcePaths: string[]): StandbyWallpaperItem[] {
  const dir = getWallpapersDir();
  const now = Date.now();
  const existing = listStandbyWallpapers();

  for (let idx = 0; idx < sourcePaths.length; idx++) {
    if (existing.length >= MAX_STANDBY_WALLPAPERS) {
      break;
    }
    const srcPath = sourcePaths[idx];
    try {
      if (!fs.existsSync(srcPath)) continue;
      const ext = path.extname(srcPath).toLowerCase();
      if (!ALLOWED_IMAGE_EXTS.has(ext)) continue;
      const stat = fs.statSync(srcPath);

      const base = path
        .basename(srcPath, path.extname(srcPath))
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 48);

      // Cek duplikasi: jika file dengan ukuran dan nama serupa sudah ada, lewati agar tidak menumpuk
      const isDuplicate = existing.some((item) => {
        const itemExt = path.extname(item.fileName).toLowerCase();
        const itemCleanBase = item.fileName.replace(/^\d+_\d+_/, '').replace(new RegExp(`\\${itemExt}$`), '');
        return item.sizeBytes === stat.size && itemCleanBase === base && itemExt === ext;
      });

      if (isDuplicate) {
        continue;
      }

      const destName = `${now}_${String(idx).padStart(3, '0')}_${base || 'wallpaper'}${ext}`;
      const destPath = path.join(dir, destName);
      fs.copyFileSync(srcPath, destPath);
      existing.push({
        fileName: destName,
        filePath: destPath,
        fileUrl: pathToFileURL(destPath).href,
        sizeBytes: stat.size
      });
    } catch (err) {
      console.error('Gagal menyalin file wallpaper:', err);
    }
  }

  return listStandbyWallpapers();
}

export function removeStandbyWallpaper(fileName: string): StandbyWallpaperItem[] {
  const dir = getWallpapersDir();
  const safeName = path.basename(fileName);
  const targetPath = path.join(dir, safeName);
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch (err) {
    console.error('Gagal menghapus file wallpaper:', err);
  }
  return listStandbyWallpapers();
}

export function clearStandbyWallpapers(): StandbyWallpaperItem[] {
  const dir = getWallpapersDir();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const targetPath = path.join(dir, entry.name);
      try {
        fs.unlinkSync(targetPath);
      } catch (err) {
        console.error('Gagal menghapus file wallpaper:', targetPath, err);
      }
    }
  } catch (err) {
    console.error('Gagal membersihkan direktori wallpaper:', err);
  }
  return [];
}

export function isStandbySlide(slideOrUrl: WebsiteSlide | string): boolean {
  if (typeof slideOrUrl === 'string') {
    return slideOrUrl.startsWith('local://standby');
  }
  return slideOrUrl.id === 'system-standby' || slideOrUrl.url.startsWith('local://standby');
}

export function writeStandbyHtmlFile(
  urlString: string,
  activeSlideCount: number,
  language: 'id' | 'en' = 'id'
): string {
  let preset = 'solid';
  let solidColor = '#09171b';

  try {
    const parsed = new URL(urlString);
    preset = parsed.searchParams.get('preset') || 'solid';
    const c = parsed.searchParams.get('color');
    if (c) {
      const decoded = decodeURIComponent(c);
      if (/^#?[0-9a-fA-F]{6}$/.test(decoded)) {
        solidColor = decoded.startsWith('#') ? decoded : `#${decoded}`;
      }
    }
  } catch {
    preset = 'solid';
  }

  const uploadedWallpapers = preset === 'custom' ? listStandbyWallpapers() : [];
  const wallpaperUrlsJson = JSON.stringify(uploadedWallpapers.map((w) => w.fileUrl));

  const hostname = os.hostname();
  const ipAddress = getPrimaryLocalIp();

  const isEn = language === 'en';
  const activeSlidesLabel = isEn
    ? `${activeSlideCount} Active ${activeSlideCount === 1 ? 'Slide' : 'Slides'}`
    : `${activeSlideCount} Slide Aktif`;
  const loadingDateLabel = isEn ? 'Loading date...' : 'Memuat tanggal...';
  const dateLocale = isEn ? 'en-US' : 'id-ID';
  const pageTitle = isEn ? 'Standby Screen' : 'Layar Standby';

  const html = `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'id'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src file: data:; script-src 'unsafe-inline';" />
  <title>${pageTitle}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background-color: ${solidColor};
      color: #ffffff;
      font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wallpaper-layer {
      position: fixed;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      background-color: ${solidColor};
    }
    .custom-bg {
      position: absolute;
      inset: 0;
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      transition: opacity 1.4s ease-in-out;
      opacity: 0;
      z-index: 1;
    }
    .custom-bg.active {
      opacity: 1;
    }
    .vignette-layer {
      position: fixed;
      inset: 0;
      z-index: 2;
      background:
        radial-gradient(circle at center, rgba(2, 6, 23, 0.05) 0%, rgba(2, 6, 23, 0.45) 100%),
        linear-gradient(to top, rgba(2, 6, 23, 0.85) 0%, rgba(2, 6, 23, 0.38) 34%, rgba(2, 6, 23, 0.05) 70%);
    }
    .lockscreen-content {
      position: fixed;
      inset: 0;
      z-index: 3;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 64px 52px 64px;
    }
    .clock-block {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      margin-bottom: 38px;
      text-shadow: 0 4px 28px rgba(0, 0, 0, 0.65);
    }
    .time-text {
      font-family: 'Segoe UI Semilight', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 350;
      font-size: clamp(76px, 9.8vw, 142px);
      line-height: 0.92;
      letter-spacing: -0.025em;
      margin-left: -0.045em;
      color: #ffffff;
    }
    .date-text {
      margin-top: 12px;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 400;
      font-size: clamp(22px, 2.4vw, 36px);
      line-height: 1.2;
      letter-spacing: -0.005em;
      color: rgba(248, 250, 252, 0.95);
    }
    .status-tray {
      display: flex;
      align-items: center;
      gap: 18px;
      color: rgba(226, 232, 240, 0.82);
      font-size: 13px;
      font-weight: 400;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
      padding-bottom: 4px;
    }
    .tray-item {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .tray-dot {
      width: 7px;
      height: 7px;
      border-radius: 9999px;
      background-color: #2ed131;
      box-shadow: 0 0 8px rgba(46, 209, 49, 0.7);
    }
    .tray-divider {
      width: 1px;
      height: 14px;
      background: rgba(255, 255, 255, 0.22);
    }
  </style>
</head>
<body>
  <div class="wallpaper-layer">
    <div id="bg-slot-a" class="custom-bg"></div>
    <div id="bg-slot-b" class="custom-bg"></div>
  </div>
  <div class="vignette-layer"></div>

  <div class="lockscreen-content">
    <div class="clock-block">
      <div id="clock" class="time-text">--:--</div>
      <div id="date" class="date-text">${loadingDateLabel}</div>
    </div>

    <div class="status-tray">
      <div class="tray-item">
        <span class="tray-dot"></span>
        <span>${activeSlidesLabel}</span>
      </div>
      <div class="tray-divider"></div>
      <div class="tray-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span>${hostname} • ${ipAddress}</span>
      </div>
    </div>
  </div>

  <script>
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    const dateFormatter = new Intl.DateTimeFormat('${dateLocale}', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    function updateClock() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      clockEl.textContent = hours + ':' + minutes;
      dateEl.textContent = dateFormatter.format(now);
    }

    updateClock();
    setInterval(updateClock, 1000);

    const customWallpapers = ${wallpaperUrlsJson};
    if (customWallpapers.length > 0) {
      const slotA = document.getElementById('bg-slot-a');
      const slotB = document.getElementById('bg-slot-b');
      let currentIdx = 0;
      let activeSlot = 'a';

      slotA.style.backgroundImage = 'url("' + customWallpapers[0] + '")';
      slotA.classList.add('active');

      if (customWallpapers.length > 1) {
        // Ganti gambar setiap 2 menit (120000ms) tanpa flash ke background default
        const INTERVAL_MS = 120000;
        setInterval(() => {
          currentIdx = (currentIdx + 1) % customWallpapers.length;
          const nextUrl = customWallpapers[currentIdx];
          const preload = new Image();
          preload.onload = () => {
            const incoming = activeSlot === 'a' ? slotB : slotA;
            const outgoing = activeSlot === 'a' ? slotA : slotB;

            incoming.style.backgroundImage = 'url("' + nextUrl + '")';
            incoming.style.zIndex = '2';
            outgoing.style.zIndex = '1';
            incoming.classList.add('active');

            setTimeout(() => {
              outgoing.classList.remove('active');
              activeSlot = activeSlot === 'a' ? 'b' : 'a';
            }, 1500);
          };
          preload.src = nextUrl;
        }, INTERVAL_MS);
      }
    }
  </script>
</body>
</html>`;

  const htmlPath = path.join(app.getPath('userData'), 'standby-lockscreen.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  return htmlPath;
}
