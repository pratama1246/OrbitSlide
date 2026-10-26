# 24/7 Kiosk & Windows Auto-Start Setup Guide - OrbitSlide

This guide outlines how to configure OrbitSlide to run 24/7 unattended as an enterprise NOC / wallboard display monitor without manual intervention following PC reboots or power outages.

---

## 1. Built-in Auto-Start (Recommended & Quickest)

1. Open OrbitSlide and press `Ctrl + ,` (or click **Settings**).
2. Under **General Preferences** and **Session & Cookie Profiles**, enable:
   - **Launch on Windows Startup** (Registers the startup entry in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
   - **Start in Fullscreen** (App launches directly in fullscreen).
   - **Auto-start Slideshow** (Slide rotation starts automatically without needing to click Play).
3. Whenever a user logs into Windows, OrbitSlide will open and rotate slides automatically.

---

## 2. Unattended Boot Setup (Windows Auto-Logon)

To ensure the display PC boots directly into the desktop without waiting at the Windows login lock screen:

1. Press `Win + R`, type `netplwiz`, and press **Enter**.
2. Select the user account used for the display monitor.
3. Uncheck **"Users must enter a user name and password to use this computer"**.
4. Click **Apply**, enter your Windows account password to confirm, and click **OK**.
5. Upon reboot or power restore, Windows will log directly into the desktop and trigger the OrbitSlide startup routine.

---

## 3. Why Not Run as a Pure Windows Service?

Enterprise administrators frequently ask whether OrbitSlide can run as a background Windows Service (e.g., via `sc.exe` or NSSM).

### Technical Explanation: *Session 0 Isolation*
- Starting with Windows Vista through Windows 11 and Windows Server, Microsoft enforces **Session 0 Isolation** for security.
- Windows Services execute exclusively in **Session 0**, which is a headless system session without graphical output.
- Applications running in Session 0 **have no access to physical display outputs (HDMI, DisplayPort) or hardware-accelerated GPU desktop rendering**.
- Running OrbitSlide as a service causes Chromium processes to execute in the background, but the physical monitor or TV remains blank or locked at the logon screen.

### Best Practice for Kiosk Displays:
Use **Auto-Logon combined with Windows Task Scheduler (Highest Privileges)**. This ensures the application runs in an interactive user session (Session 1+) with full GPU rendering and no UAC prompt interruptions.

---

## 4. Automated Task Scheduler Setup (PowerShell)

A PowerShell script is provided in `scripts/setup-windows-kiosk.ps1`.

### Usage:
1. Open PowerShell as **Administrator** (*Run as Administrator*).
2. Execute the script:
   ```powershell
   cd d:\Project-Web\MonitorSlide\scripts
   .\setup-windows-kiosk.ps1 -InstallTask
   ```
3. To uninstall the scheduled task:
   ```powershell
   .\setup-windows-kiosk.ps1 -UninstallTask
   ```
