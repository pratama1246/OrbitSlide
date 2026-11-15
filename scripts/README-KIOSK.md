# Configure OrbitSlide at Windows sign-in

Use this guide after [configuring and testing a slideshow](../README.md#configure-a-slideshow). It assumes you can manage Windows sign-in and scheduled tasks. Visible slides require an interactive desktop session; starting a GUI as a service is not equivalent to showing it on the signed-in user's monitor.

## Choose a startup method

Prefer the built-in launch-on-startup setting for an ordinary display account. Use the supplied Task Scheduler script when the host owner specifically needs a scheduled task. Choose one method and test it; duplicate startup entries complicate diagnosis. Neither method configures Windows auto-logon or guarantees recovery after every power/network failure.

## Enable built-in startup

1. In OrbitSlide, open Settings with the interface control or Alt+S while focus is in a website.
2. Enable launch-on-startup for the intended Windows account.
3. Set start-fullscreen and auto-start-monitoring according to the display's intended behavior.
4. Save the settings.
5. During an agreed window, sign out and sign back in with that account.

Expected result: OrbitSlide launches in that user's desktop and displays the intended sites. Site login/MFA may still be needed. Disable the same setting to remove this startup method.

## Register a scheduled task

Run these commands in PowerShell from the OrbitSlide repository root. Inspect the script and target executable before registration; registration changes the named task `OrbitSlide_Kiosk`.

1. Confirm the intended packaged `OrbitSlide.exe` exists at the path you will use.
2. Register the task, replacing the example with that executable's absolute path:

   ```powershell
   .\scripts\setup-windows-kiosk.ps1 -InstallTask -CustomExePath 'C:\Path\To\OrbitSlide.exe'
   ```

3. Inspect the task using:

   ```powershell
   .\scripts\setup-windows-kiosk.ps1 -CheckStatus
   ```

4. In Windows Task Scheduler, inspect the action path, user, logon trigger, and privilege level for `OrbitSlide_Kiosk`.
5. Sign out/in during an agreed test window and verify the displayed sites.

Expected result: the task points to the intended executable and launches at that user's logon. The script defaults to **Limited** privileges; `-Elevated` requests **Highest** and should only be used when the host owner has identified a need. Elevate PowerShell only if task policy requires it. Do not point a deployed task at the development Electron executable merely because it is found by fallback discovery.

Running the script without an action switch displays guidance; it does not register a task. The script's informational text about elevation is broader than its actual default behavior, so verify the task properties rather than assuming elevation is mandatory.

## Remove the task

1. In PowerShell at the repository root, run `.\scripts\setup-windows-kiosk.ps1 -UninstallTask`.
2. Run `.\scripts\setup-windows-kiosk.ps1 -CheckStatus`.
3. Confirm the built-in startup option is also disabled if no automatic launch is wanted.

Expected result: `OrbitSlide_Kiosk` is absent and no unintended duplicate startup mechanism remains.

## Troubleshoot and escalate

| Symptom | Check | Escalate when |
|---|---|---|
| No visible window after boot | Confirm the intended user has signed in; inspect task history and action path. | Account/logon policy or Windows service/session changes are required. |
| Task points to missing build | Inspect `CustomExePath` and the installed location. | Repair needs reinstalling or changing the approved release. |
| Duplicate launches | Inspect built-in startup and Task Scheduler entries. | Account/task ownership is unclear; ask the host administrator before removing entries. |
| App launches but sites fail | Follow [application troubleshooting](../README.md#troubleshooting-and-escalation). | Network/site authentication or application code needs repair. |

Windows auto-logon is a separate host-security decision; this procedure does not configure it. Supply sanitized task properties/history, app version, Windows account context, and timestamps to the host administrator or project maintainer. Do not share Windows passwords or authenticated browser data.
