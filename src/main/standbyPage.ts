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
  let preset = 'mountains';

  try {
    const parsed = new URL(urlString);
    preset = parsed.searchParams.get('preset') || 'mountains';
  } catch {
    preset = 'mountains';
  }

  const uploadedWallpapers = preset === 'custom' ? listStandbyWallpapers() : [];
  const wallpaperUrlsJson = JSON.stringify(uploadedWallpapers.map((w) => w.fileUrl));

  const hostname = os.hostname();
  const ipAddress = getPrimaryLocalIp();

  const mountainsSvg = `
    <svg class="scene-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#030712" />
          <stop offset="38%" stop-color="#0b172a" />
          <stop offset="72%" stop-color="#172e4c" />
          <stop offset="100%" stop-color="#1e3a5f" />
        </linearGradient>
        <radialGradient id="moonGlow" cx="76%" cy="22%" r="32%">
          <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.22" />
          <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.06" />
          <stop offset="100%" stop-color="#030712" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="mist" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0" />
          <stop offset="50%" stop-color="#93c5fd" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#020617" stop-opacity="0.35" />
        </linearGradient>
        <linearGradient id="mtn1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e3452" />
          <stop offset="100%" stop-color="#0f1d33" />
        </linearGradient>
        <linearGradient id="mtn2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#14243b" />
          <stop offset="100%" stop-color="#091324" />
        </linearGradient>
        <linearGradient id="mtn3" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0b1526" />
          <stop offset="100%" stop-color="#030812" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky)" />
      <rect width="1920" height="1080" fill="url(#moonGlow)" />
      <g fill="#e2e8f0" opacity="0.65">
        <circle cx="210" cy="140" r="1.3" />
        <circle cx="380" cy="95" r="1.8" opacity="0.8" />
        <circle cx="540" cy="210" r="1.1" />
        <circle cx="720" cy="120" r="1.5" />
        <circle cx="890" cy="80" r="1.2" />
        <circle cx="1080" cy="175" r="1.6" />
        <circle cx="1290" cy="110" r="1.2" />
        <circle cx="1640" cy="150" r="1.5" />
        <circle cx="1790" cy="90" r="1.1" />
        <circle cx="140" cy="290" r="1.2" opacity="0.5" />
        <circle cx="960" cy="260" r="1.3" opacity="0.5" />
        <circle cx="1510" cy="280" r="1.2" opacity="0.4" />
      </g>
      <circle cx="1460" cy="235" r="42" fill="#f8fafc" opacity="0.92" />
      <circle cx="1476" cy="222" r="38" fill="#0d1c33" />
      <polygon points="0,720 180,560 350,650 580,440 790,590 1040,420 1260,575 1490,460 1710,590 1920,490 1920,1080 0,1080" fill="url(#mtn1)" />
      <rect y="520" width="1920" height="240" fill="url(#mist)" />
      <polygon points="0,780 260,590 480,710 760,520 1010,690 1320,510 1580,670 1790,560 1920,630 1920,1080 0,1080" fill="url(#mtn2)" />
      <polygon points="0,850 190,740 460,820 820,660 1140,810 1440,680 1720,790 1920,720 1920,1080 0,1080" fill="url(#mtn3)" />
    </svg>
  `;

  const oceanSvg = `
    <svg class="scene-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="oceanSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#040814" />
          <stop offset="35%" stop-color="#0c192c" />
          <stop offset="62%" stop-color="#1d3557" />
          <stop offset="78%" stop-color="#2b4c7e" />
          <stop offset="100%" stop-color="#071120" />
        </linearGradient>
        <radialGradient id="horizonGlow" cx="65%" cy="62%" r="45%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28" />
          <stop offset="45%" stop-color="#fb923c" stop-opacity="0.10" />
          <stop offset="100%" stop-color="#040814" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="sea" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#162a45" />
          <stop offset="40%" stop-color="#0c192c" />
          <stop offset="100%" stop-color="#030712" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#oceanSky)" />
      <rect width="1920" height="1080" fill="url(#horizonGlow)" />
      <path d="M 980 670 Q 1120 610 1290 670 Z" fill="#0f1e36" />
      <path d="M 1240 670 Q 1440 575 1680 670 Z" fill="#0b1629" />
      <rect y="668" width="1920" height="412" fill="url(#sea)" />
      <g fill="#7dd3fc" opacity="0.18">
        <rect x="1180" y="682" width="140" height="2" rx="1" />
        <rect x="1140" y="696" width="210" height="2" rx="1" />
        <rect x="1210" y="714" width="110" height="2" rx="1" />
        <rect x="1090" y="734" width="260" height="2" rx="1" />
        <rect x="1170" y="758" width="160" height="2.5" rx="1" />
      </g>
      <polygon points="0,560 220,590 410,668 590,740 720,860 0,1080" fill="#050b16" />
    </svg>
  `;

  const forestSvg = `
    <svg class="scene-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="forestSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#030914" />
          <stop offset="45%" stop-color="#0a1929" />
          <stop offset="80%" stop-color="#132a3e" />
          <stop offset="100%" stop-color="#07131e" />
        </linearGradient>
        <radialGradient id="aurora" cx="50%" cy="25%" r="50%">
          <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.18" />
          <stop offset="55%" stop-color="#0ea5e9" stop-opacity="0.07" />
          <stop offset="100%" stop-color="#030914" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#forestSky)" />
      <rect width="1920" height="1080" fill="url(#aurora)" />
      <g fill="#cbd5e1" opacity="0.55">
        <circle cx="290" cy="130" r="1.4" />
        <circle cx="640" cy="95" r="1.2" />
        <circle cx="1020" cy="145" r="1.6" />
        <circle cx="1390" cy="88" r="1.3" />
        <circle cx="1710" cy="165" r="1.4" />
      </g>
      <path d="M0,700 Q480,550 960,670 T1920,610 L1920,1080 L0,1080 Z" fill="#0f2233" />
      <path d="M0,770 Q520,660 1080,750 T1920,710 L1920,1080 L0,1080 Z" fill="#091724" />
      <path d="M0,850 Q640,760 1280,840 T1920,800 L1920,1080 L0,1080 Z" fill="#040b12" />
    </svg>
  `;

  const selectedSvg =
    preset === 'ocean' ? oceanSvg : preset === 'forest' ? forestSvg : mountainsSvg;

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
      background-color: #09171b;
      color: #ffffff;
      font-family: 'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wallpaper-layer {
      position: fixed;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      animation: subtleZoom 45s ease-in-out infinite alternate;
    }
    .scene-svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .custom-bg {
      position: absolute;
      inset: 0;
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      transition: opacity 1.4s ease-in-out;
      opacity: 0;
    }
    .custom-bg.active {
      opacity: 1;
    }
    @keyframes subtleZoom {
      0% { transform: scale(1); }
      100% { transform: scale(1.035); }
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
    ${selectedSvg}
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
        setInterval(() => {
          currentIdx = (currentIdx + 1) % customWallpapers.length;
          const nextUrl = customWallpapers[currentIdx];
          const preload = new Image();
          preload.onload = () => {
            if (activeSlot === 'a') {
              slotB.style.backgroundImage = 'url("' + nextUrl + '")';
              slotB.classList.add('active');
              slotA.classList.remove('active');
              activeSlot = 'b';
              setTimeout(() => {
                if (activeSlot === 'b') slotA.style.backgroundImage = '';
              }, 1500);
            } else {
              slotA.style.backgroundImage = 'url("' + nextUrl + '")';
              slotA.classList.add('active');
              slotB.classList.remove('active');
              activeSlot = 'a';
              setTimeout(() => {
                if (activeSlot === 'a') slotB.style.backgroundImage = '';
              }, 1500);
            }
          };
          preload.src = nextUrl;
        }, 8000);
      }
    }
  </script>
</body>
</html>`;

  const htmlPath = path.join(app.getPath('userData'), 'standby-lockscreen.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  return htmlPath;
}
