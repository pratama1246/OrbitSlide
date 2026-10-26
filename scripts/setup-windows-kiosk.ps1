<#
.SYNOPSIS
    Setup OrbitSlide sebagai Kiosk 24/7 di Windows atau mendaftarkan Task Scheduler dengan hak akses tertinggi.

.DESCRIPTION
    Script ini membantu setup otomatis:
    1. Task Scheduler (Tugas Terjadwal) agar OrbitSlide otomatis berjalan saat login pengguna dengan Highest Privileges (tanpa popup UAC).
    2. Informasi konfigurasi Windows Auto-Logon untuk PC wallboard / TV monitoring tanpa operator.
    3. Penjelasan teknis mengapa Windows Service murni (Session 0) tidak menampilkan GUI pada layar monitor.
#>

param(
    [switch]$InstallTask,
    [switch]$UninstallTask,
    [switch]$CheckStatus
)

$TaskName = "OrbitSlide_Kiosk"
$ProjectDir = Split-Path -Parent $PSScriptRoot
$Executable = "$ProjectDir\node_modules\electron\dist\electron.exe"

$PackagedExe = Get-ChildItem -Path "$ProjectDir" -Filter "OrbitSlide*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($PackagedExe) {
    $TargetExe = $PackagedExe.FullName
    $Arguments = ""
} else {
    $TargetExe = $Executable
    $Arguments = "`"$ProjectDir`""
}

function Show-Header {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " OrbitSlide - Setup Kiosk & Auto-Start 24/7 Windows      " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
}

function Check-TaskStatus {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "[OK] Task Scheduler '$TaskName' terdaftar." -ForegroundColor Green
        Write-Host "     State: $($task.State)" -ForegroundColor Gray
    } else {
        Write-Host "[INFO] Task Scheduler '$TaskName' belum terdaftar." -ForegroundColor Yellow
    }
}

function Install-KioskTask {
    Write-Host "`n[*] Mendaftarkan Task Scheduler '$TaskName'..." -ForegroundColor Cyan
    
    $action = New-ScheduledTaskAction -Execute $TargetExe -Argument $Arguments -WorkingDirectory $ProjectDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0)

    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
        Write-Host "[OK] Task Scheduler '$TaskName' berhasil didaftarkan!" -ForegroundColor Green
        Write-Host "     Aplikasi akan otomatis berjalan setiap pengguna login dengan Hak Akses Tertinggi." -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Gagal mendaftarkan task: $_" -ForegroundColor Red
        Write-Host "Pastikan PowerShell dijalankan sebagai Administrator (Run as Administrator)." -ForegroundColor Yellow
    }
}

function Uninstall-KioskTask {
    Write-Host "`n[*] Menghapus Task Scheduler '$TaskName'..." -ForegroundColor Cyan
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-Host "[OK] Task Scheduler '$TaskName' berhasil dihapus." -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Gagal menghapus task atau task tidak ditemukan: $_" -ForegroundColor Red
    }
}

Show-Header

if ($InstallTask) {
    Install-KioskTask
    exit
}

if ($UninstallTask) {
    Uninstall-KioskTask
    exit
}

Check-TaskStatus

Write-Host @"

PANDUAN KIOSK 24/7 & WINDOWS SERVICE:
-------------------------------------
1. MENGAPA TIDAK SEBAGAI WINDOWS SERVICE MURNI?
   Windows Service berjalan di 'Session 0' yang diisolasi oleh Microsoft sejak Windows Vista.
   Layanan di Session 0 TIDAK MEMILIKI antarmuka visual (tidak ada akses display / GPU ke layar monitor).
   Jika OrbitSlide dijalankan sebagai service murni (misal via sc.exe atau NSSM),
   aplikasi berjalan di latar belakang tetapi layar TV / monitor fisik akan tetap hitam / login screen.

2. METODE TERBAIK UNTUK WALLBOARD DISPLAY / NOC:
   a. Aktifkan 'Auto-Start saat Windows Menyala' pada menu Pengaturan OrbitSlide.
   b. Aktifkan 'Mulai Layar Penuh' dan 'Auto-start Monitoring'.
   c. Setup Windows Auto-Logon (agar PC login tanpa ketik password saat listrik nyala):
      - Tekan Win+R, ketik 'netplwiz', tekan Enter.
      - Hilangkan centang 'Users must enter a user name and password to use this computer'.
      - Klik Apply, masukkan password akun Windows Anda, lalu klik OK.

3. DAFTARKAN TASK DENGAN PRIVILEGE TINGGI:
   Jalankan perintah ini di PowerShell (Run as Administrator):
   .\setup-windows-kiosk.ps1 -InstallTask

"@ -ForegroundColor White
