# OrbitSlide

> **Turn Any Screen into an Automated Web Display & Digital Signage**

OrbitSlide transforms any Windows PC, secondary monitor, mini PC, or smart display into a seamless, automated full-screen web slideshow. Rotate multiple web dashboards, digital signage presentations, queue systems, or live web feeds with smooth transitions, persistent login sessions, and zero-telemetry local privacy.

From smart home tablets and cafe digital menu boards to office sprint displays and 24/7 command centers — OrbitSlide keeps your web displays rotating reliably without blank screens or expired session prompts.

Built with a high-performance modern architecture (**Windows 10 & 11 x64**) powered by native `WebContentsView`, intelligent background resource throttling, non-blocking asynchronous SQLite storage, and minimal RAM footprint.

---

## 💡 Perfect For Every Display

- ☕ **Retail, Cafes & Kiosks (Digital Signage)**
  - Run dynamic digital menu boards (Canva, web menus), promotional slides, price lists, or customer queue displays without paying for expensive digital signage software subscriptions.
- 🏢 **Offices & Team Workspaces**
  - Rotate agile sprint boards (Trello, Jira, Linear), live sales metrics, customer support queues, KPI dashboards, and internal announcements in common areas.
- 🏠 **Smart Home & Homelabs**
  - Turn an idle PC or monitor into an ambient smart home display: Home Assistant dashboards, live weather, family calendar, stock/crypto tickers, or clock screens.
- 🖥️ **NOC, DevOps & IT Operations**
  - Monitor live Grafana dashboards, Zabbix, Portainer, Kubernetes status, and internal intranet portals with isolated cookie sessions and self-signed SSL bypass.
- 📺 **Ambient Displays & Secondary Monitors**
  - Dedicate a secondary monitor on your desk for automated news feeds, analytics, social streams, or live streaming widgets.

---

## Key Features

- **Automated Slideshow & Zero-Flicker Preloading**
  - Smooth slide transitions with sliding animations.
  - Background preloading of upcoming slides for instant switching without blank white screens.
  - Intelligent background throttling: off-screen slide views throttle background rendering to conserve CPU and RAM while keeping live WebSocket metrics running.
  - Per-slide custom durations or global interval configuration.
  - Operator idle detection: if an operator moves the mouse to inspect a dashboard, the slideshow pauses temporarily and resumes automatically after inactivity.

- **Persistent Sessions & Multi-Profile Cookies**
  - Isolated Chromium session profiles (*Default*, *Admin*, *Read-only*, or custom names).
  - Cookies, tokens, and local storage persist across application restarts (no repeated login prompts).
  - Configurable SSL bypass for local intranet dashboards using self-signed certificates.

- **Minimalist Standby Screen & Custom Wallpapers**
  - When no slides are active, OrbitSlide displays a clean control room standby screen with a real-time digital clock, localized date, and live status beacon (`#2ed131`).
  - Customizable solid OLED background color with native color-picker support.
  - Custom wallpaper upload support (up to 3 images from local PC with smooth 2-minute crossfade transitions).

- **Bilingual Interface (English & Indonesian)**
  - Automatic language selection based on system region and timezone (Indonesia defaults to Indonesian, international systems default to English).
  - Instant language switcher available in the top navigation bar.

- **Keyboard Controls & Kiosk Automation**
  - Fast keyboard shortcuts for pause, resume, fullscreen toggle, and manual slide navigation.
  - Borderless kiosk mode with an automated PowerShell script to launch OrbitSlide on Windows startup.

- **Local-First & Zero Telemetry**
  - All configurations, slide lists, and session profiles are stored locally in SQLite (`orbitslide.db`) via non-blocking asynchronous I/O.
  - No analytics, telemetry, or tracking pings are sent to external servers.

---

## Design System & Palette

OrbitSlide utilizes **Plus Jakarta Sans** typography with a dedicated high-contrast control room palette:
- **Light Blue** (`#40a4bf`, `#338399`): Primary identity, focused buttons, and active accents.
- **Orange** (`#f58320`): Warning states, pause indicators, and interactive highlights.
- **Mustard** (`#caa935`): Slide transitions and secondary warnings.
- **Forest Green** (`#19414d`, `#255866`): Dark panel surfaces, cards, and navigation chrome.
- **Deep Navy / Background** (`#09171b`): High-contrast OLED/dark background for 24/7 command center displays.
- **Live Beacon** (`#2ed131`): Real-time active status beacon.

---

## Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Space` | Pause or resume slideshow rotation |
| `F11` | Toggle between Fullscreen and windowed mode |
| `Esc` | Exit Fullscreen mode |
| `Ctrl + Left Arrow` | Navigate to previous slide manually |
| `Ctrl + Right Arrow` | Navigate to next slide manually |
| `Ctrl + ,` | Open or close Settings dialog |

---

## Installer Packages

All installer binaries are generated as standalone NSIS setup files:

| Installer File | Target Operating System | Architecture |
| :--- | :--- | :--- |
| **`OrbitSlide-Setup-1.0.0.exe`** | Windows 10 & 11 | x64 (Modern Chromium/Electron) |

---

## Development Guide

### Prerequisites
- Node.js v18+ (LTS or v20+ recommended)
- npm or yarn

### Installation
```bash
npm install
```

### Running in Development Mode
```bash
npm run dev
```

### Building Production Installers
```bash
# Build production installer for Windows 10 & 11 (x64)
npm run package

# Build unpacked directory for testing
npm run package:dir
```

---

## Windows Kiosk Setup (Auto-Start)

To deploy OrbitSlide on dedicated 24/7 unattended display PCs:
1. Open PowerShell as Administrator.
2. Run the deployment script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\setup-windows-kiosk.ps1
   ```
3. The script registers a Windows Task Scheduler job to launch OrbitSlide automatically on user logon without interactive prompt interruptions.

For further configuration details, refer to [scripts/README-KIOSK.md](scripts/README-KIOSK.md).

---

## License, Terms & Privacy

- License: [MIT License](LICENSE)
- Terms of Use: [TERMS.md](TERMS.md)
- Privacy Policy: [PRIVACY.md](PRIVACY.md)

Copyright © 2026 OrbitSlide. All rights reserved.
