# OrbitSlide

> **Enterprise & NOC Multi-Website Monitoring Display with Automated Slideshow & Persistent Sessions**

OrbitSlide is designed for control room monitoring displays (NOC, SOC, Command Center, and Kiosk Displays). It enables multiple web dashboards (such as Grafana, Zabbix, Portainer, Kibana, or internal enterprise web portals) to rotate automatically in seamless fullscreen without losing active login sessions.

OrbitSlide supports legacy Windows versions (**Windows 7, 8, and 8.1**) as well as modern versions (**Windows 10 and 11**) with high performance and low memory consumption.

---

## Key Features

- **Automated Slideshow & Background Preloading**
  - Smooth slide transitions with sliding animations.
  - Background preloading of upcoming slides for instant switching without blank white screens.
  - Per-slide custom durations or global interval configuration.
  - User idle detection: if a operator moves the mouse to inspect a dashboard, the slideshow pauses temporarily and resumes automatically after inactivity.

- **Session Management & Cookie Partitioning**
  - Isolated Chromium session profiles (*Default*, *Admin*, *Read-only*, or custom names).
  - Cookies and local storage persist locally across application restarts (no repeated login prompts).
  - Configurable SSL bypass for local intranet dashboards using self-signed certificates.

- **Enterprise NOC Standby Screen**
  - When no slides are active, OrbitSlide displays a clean control room standby screen with a real-time digital clock, localized date, live status beacon (`#2ed131`), and optional custom wallpapers.

- **Bilingual Interface (English & Indonesian)**
  - Automatic language selection based on system region and timezone (Indonesia defaults to Indonesian, international systems default to English).
  - Instant language switcher available in the top navigation bar.

- **Keyboard Controls & Kiosk Automation**
  - Fast keyboard shortcuts for pause, resume, fullscreen toggle, and manual slide navigation.
  - Borderless kiosk mode with an automated PowerShell script to launch OrbitSlide on Windows startup.

- **Local-First & Zero Telemetry**
  - All configurations, slide lists, and session profiles are stored locally in SQLite (`orbitslide.db`).
  - No analytics, telemetry, or tracking pings are sent to external servers.

---

## Design System & Palette

OrbitSlide utilizes **Plus Jakarta Sans** typography with a dedicated control room palette:
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
| **`OrbitSlide-Setup-1.0.0-legacy.exe`** | Windows 7, 8, 8.1 | Universal Combo (Auto-detects 32-bit & 64-bit) |
| **`OrbitSlide-Setup-1.0.0-legacy-x64.exe`** | Windows 7, 8, 8.1 | Dedicated 64-bit |
| **`OrbitSlide-Setup-1.0.0-legacy-ia32.exe`** | Windows 7, 8, 8.1 | Dedicated 32-bit (Legacy PCs, Thin Clients) |

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
# Build for modern Windows 10 & 11
npm run package

# Build for legacy Windows 7, 8 & 8.1
npm run package:legacy

# Build all packages simultaneously
npm run package:all
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
