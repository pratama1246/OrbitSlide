# Panduan Setup Kiosk 24/7 & Auto-Start Windows - MonitorSlide

Dokumen ini menjelaskan konfigurasi otomatisasi agar MonitorSlide dapat berjalan 24 jam nonstop sebagai display monitor NOC / wallboard tanpa memerlukan intervensi manual setelah komputer dinyalakan atau reboot akibat pemadaman listrik.

---

## 1. Auto-Start Bawaan (Paling Praktis)

1. Buka MonitorSlide dan masuk ke menu **Pengaturan** (`Alt+S`).
2. Pada kartu **Preferensi Monitoring**, aktifkan opsi:
   - **Auto-Start saat Windows Menyala** (Menambahkan registry startup `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
   - **Mulai Layar Penuh** (Aplikasi langsung fullscreen saat terbuka).
   - **Auto-start Monitoring** (Rotasi slide langsung berjalan tanpa perlu klik tombol Putar).
3. Selesai. Setiap kali user login ke Windows, MonitorSlide akan otomatis terbuka dan memutar slide.

---

## 2. Setup Unattended Boot (Auto-Logon Windows)

Agar PC TV/Wallboard dapat menyala dan langsung masuk desktop tanpa berhenti di halaman login Windows:

1. Tekan `Win + R`, ketik `netplwiz`, lalu tekan **Enter**.
2. Pilih nama akun pengguna yang digunakan untuk display.
3. Hilangkan centang pada opsi **"Users must enter a user name and password to use this computer"** (Pengguna harus memasukkan nama pengguna dan kata sandi untuk menggunakan komputer ini).
4. Klik **Apply**. Masukkan kata sandi akun Windows Anda untuk konfirmasi, lalu klik **OK**.
5. Saat komputer dinyalakan ulang (reboot/power on), Windows akan otomatis masuk ke desktop dan memicu auto-start MonitorSlide.

---

## 3. Mengapa Tidak Dijalankan Sebagai Windows Service Murni?

Banyak administrator bertanya apakah aplikasi ini bisa dijadikan Windows Service murni (misalnya menggunakan `sc.exe` atau NSSM).

### Penjelasan Teknis: *Session 0 Isolation*
- Sejak Windows Vista hingga Windows 11 / Windows Server 2025, Microsoft menerapkan **Session 0 Isolation** untuk alasan keamanan.
- Semua Windows Service berjalan di **Session 0**, yaitu sesi sistem tanpa antarmuka grafis (*headless*).
- Aplikasi di Session 0 **tidak memiliki akses ke monitor fisik (HDMI/DisplayPort) maupun GPU rendering**.
- Jika MonitorSlide dijalankan sebagai service murni, proses Chromium akan berjalan di background tetapi **layar fisik monitor/TV akan tetap kosong atau tertahan di layar login**.

### Solusi Terbaik untuk Kiosk Display:
Gunakan **Auto-Logon + Windows Task Scheduler dengan Hak Akses Tertinggi (Highest Privileges)**. Ini memastikan aplikasi berjalan di sesi pengguna aktif (Session 1+) dengan hak administrator penuh tanpa terhalang prompt UAC.

---

## 4. Mendaftarkan Task Scheduler Otomatis (PowerShell)

Telah disediakan script PowerShell di folder `scripts/setup-windows-kiosk.ps1`.

### Cara Penggunaan:
1. Buka PowerShell sebagai **Administrator** (*Run as Administrator*).
2. Jalankan perintah:
   ```powershell
   cd d:\Project-Web\MonitorSlide\scripts
   .\setup-windows-kiosk.ps1 -InstallTask
   ```
3. Untuk menghapus task:
   ```powershell
   .\setup-windows-kiosk.ps1 -UninstallTask
   ```
