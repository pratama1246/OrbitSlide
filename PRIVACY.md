# Privacy Policy

**OrbitSlide Application**  
**Last Updated:** October 26, 2026

Welcome to **OrbitSlide**. Your privacy is our top priority. This Privacy Policy explains how the OrbitSlide desktop application ("Application", "we", "us", "our") treats information and data when you use our software.

This Privacy Policy is prepared with reference to personal data protection principles, including **Law of the Republic of Indonesia Number 27 of 2022 concerning Personal Data Protection (UU PDP)** and relevant global privacy standards.

By installing and using the Application, you consent to the data handling practices described in this document.

---

### 1. Core Principles: Local Architecture and Zero-Telemetry

OrbitSlide is built with a **Privacy by Design** and **Local-First Architecture** philosophy:

1. **Zero-Telemetry:** The Application DOES NOT collect, DOES NOT track, and DOES NOT transmit usage analytics, telemetry data, user identities, visited site history, or monitoring behavior to developer servers or any third party.
2. **Full Client-Side Storage:** All configuration data, slide lists, web links, interval settings, and image files you enter are stored 100% locally on your computer storage device.
3. **No Centralized User Account:** You are not required to register an account, enter an email address, phone number, or other personal identity to use any features of the Application.

---

### 2. Information Processed and Stored Locally

The Application processes several categories of technical data strictly required to perform display and monitor rotation functions:

#### A. Slide Configuration Data
* **Link Address (URL):** Website or local dashboard addresses you specify for monitor rotation.
* **Slide Label & Duration:** Slide display name and duration (in seconds).
* **Display Order:** The slide rotation sequence you configure.
* *Storage Location:* Stored in a structured local SQLite database (`orbitslide.db`) inside the user data folder (`userData`).

#### B. Web Browsing Sessions and Cookies
* **Cookies and Login Sessions:** When you open web pages requiring login (such as Grafana or internal dashboards), the built-in Chromium engine stores sessions and cookies in a local partition profile (`persist:profile_name`).
* *Confidentiality:* Those cookies and session data can never be accessed by OrbitSlide developers or sent to external parties.
* *Full Control:* You can clear session data and profile cookies at any time through the "Session & Cookie Profiles" settings menu in the Application.

#### C. Custom Wallpaper Files (Standby Lock Screen)
* **Image Files:** Background image files you upload for the standby screen (JPG, PNG, WEBP, GIF, etc.) are copied to the local folder `%APPDATA%\OrbitSlide\wallpapers`.
* *Retention Policy:* Images are kept only as long as you need them. When you delete an image through the Application interface, the physical file is permanently deleted from your computer storage using direct file system calls (`fs.unlinkSync`).

#### D. Device System Information (For Diagnostic Display Only)
* **Diagnostic Information:** Windows OS version, processor architecture (x64/arm64), Electron version, Chromium version, and local IPv4 address.
* *Purpose:* Read in real time at runtime solely for display in the "About Application" window and standby screen widget. This information is NEVER sent outside the device.

---

### 3. Legal Basis for Data Processing

Pursuant to Article 20 of Law Number 27 of 2022 concerning Personal Data Protection (UU PDP), local data processing performed by the Application is based on:
1. **Valid and Explicit Consent:** The User independently enters URLs and image files into the Application for monitor display operations.
2. **Fulfillment of Contractual / Functional Obligations:** Processing of configuration data is carried out solely so the Application can perform the core functions expected by the User (loading slides, rotating displays, and maintaining browsing sessions).

---

### 4. No Data Sharing with Third Parties

1. We do not sell, trade, rent, or share any User data with any third party.
2. The Application does not include third-party SDKs, Google Analytics, Facebook Pixel, tracking ads, or external monitoring scripts in its core codebase.
3. All network communication during slide playback occurs directly between your computer device and the target URL server you configured, without passing through any proxy server owned by OrbitSlide developers.

---

### 5. Data Security

Although the Application does not store your data in the cloud, device-level data security remains an important priority:
1. **Isolated Storage:** Data files are stored in the standard Windows user application data directory protected by your operating system user account permissions.
2. **Session Partition Isolation:** Each browsing session profile is strictly isolated by Chromium Context Partitioning to prevent cross-session cookie leakage.
3. **User Security Responsibility:** Physical computer security, Windows OS account password protection, and antivirus or firewall usage on the host device are the responsibility of the User.

---

### 6. Personal Data Subject Rights

In accordance with Chapter IV of Law Number 27 of 2022 concerning Personal Data Protection (UU PDP), Users have the following rights exercisable directly and independently within the Application:

1. **Right to Access Information:** You have the right to view all data stored within the Application at any time via the Settings menu.
2. **Right to Update and Rectify:** You have the right to change URL addresses, slide names, durations, wallpaper themes, or other configurations at any time.
3. **Right to Erasure:**
   - You can delete slides individually or entirely.
   - You can delete cookies and login sessions via the "Reset Cookie" button.
   - You can delete wallpaper images at any time, or use "Delete All" to remove all uploaded image files from disk.
   - Uninstalling the Application and deleting `%APPDATA%\OrbitSlide` will eliminate 100% of related data without leaving traces on external servers.
4. **Right to Withdraw Consent:** You can stop using the Application at any time by closing or uninstalling it from your computer.

---

### 7. Links to Third-Party Websites

The Application loads and displays external websites specified by the User. This Privacy Policy ONLY governs the OrbitSlide Application. When the Application loads external websites (such as Google, Grafana Cloud, news portals, or third-party vendor dashboards), the privacy policy and terms of use of those respective websites apply to data you submit to them. We encourage you to read the privacy policies of every external website you display.

---

### 8. Children's Privacy Protection

The Application is not specifically directed at children under the age of 13, and never knowingly collects personally identifiable information from children. Because all data is local to the User's device, supervision of hardware usage by minors is the responsibility of parents or guardians.

---

### 9. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect updates to Application features or changes in applicable legal regulations. The latest version will always be listed with the "Last Updated" date on this document. You are advised to review this page periodically.

---

### 10. Developer Contact and Information

If you have any questions, clarifications, or concerns regarding this Privacy Policy or privacy handling in the OrbitSlide application, please open a discussion or report through the official project repository or administrative communication channels of the OrbitSlide developers.
