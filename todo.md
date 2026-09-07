# Extensible — Module Roadmap & Backlog

Daftar rekomendasi modul baru yang direncanakan untuk ekosistem **Extensible** Chrome Extension suite.

---

## 🚀 Active & Completed Modules
- [x] **TempMail (`temp-mail`)**
  - Disposable email generation via live API (`api.tempmail.ing`).
  - Auto-fill email trigger on web page inputs (`TempMailContentController`).
  - Real-time inbox reader, message details, and OTP auto-extractor.
  - In-drawer countdown timer and state sync via `StorageService`.

---

## 📋 Recommended Modules Pipeline

### 1. 🛡️ Fake Identity / Persona Generator
> **Priority:** High | **Target:** QA / Testers / Privacy Users | **Synergy:** TempMail
- [ ] **Core Service (`identity.service.ts`)**:
  - Generator nama lengkap, username, password kuat, alamat dummy, dan nomor telepon virtual.
  - Pengaturan locale / format negara data dummy.
- [ ] **Content Controller (`identity-content.controller.ts`)**:
  - Context menu / in-page icon untuk "Autofill Full Registration Form" sekali klik.
  - Pemetaan field otomatis (first name, last name, phone, address, username, password).
- [ ] **Popup View (`identity-popup.view.ts`)**:
  - Kartu identitas virtual di side drawer dengan tombol quick-copy per atribut.
  - Tombol *Regenerate* dan *Save Favorite Persona*.

---

### 2. 🔐 2FA / TOTP Authenticator
> **Priority:** High | **Target:** Security / Power Users
- [ ] **Core Service (`totp.service.ts`)**:
  - Generator token 6-digit standar RFC 6238 berbasis secret key (SHA-1 HMAC).
  - Countdown timer rotasi 30 detik.
  - Penyimpanan vault terenkripsi di `StorageService`.
- [ ] **Content Controller (`totp-content.controller.ts`)**:
  - Deteksi otomatis input OTP/2FA pada form login dan autofill kode yang sesuai.
- [ ] **Popup View (`totp-popup.view.ts`)**:
  - Daftar akun 2FA dengan copy-to-clipboard instan.
  - Import secret key manual atau scan QR code dari layar.

---

### 3. ⚡ JWT & JSON Inspector
> **Priority:** Medium | **Target:** Frontend & Backend Developers
- [ ] **Core Service (`jwt-inspector.service.ts`)**:
  - Decoder header dan payload JWT (klaim standard: `exp`, `sub`, `roles`, dsb.).
  - JSON formatter, validator, dan minifier.
- [ ] **Content Controller (`jwt-content.controller.ts`)**:
  - Sniffing otomatis token JWT dari `localStorage`, `sessionStorage`, atau `cookies` domain aktif.
- [ ] **Popup View (`jwt-popup.view.ts`)**:
  - Tab JSON Pretty-Print dengan syntax highlighting.
  - Tab JWT Decoder dengan status kedaluwarsa token (expired vs valid).

---

### 4. 🎨 Eyedropper & Asset Sniffer
> **Priority:** Medium | **Target:** Frontend Developers & Designers
- [ ] **Core Service (`eyedropper.service.ts`)**:
  - Integrasi native `window.EyeDropper` API untuk pick warna di mana pun pada viewport.
  - Konversi format warna real-time (HEX, RGB, HSL).
- [ ] **Content Controller (`asset-sniffer-content.controller.ts`)**:
  - Deteksi typography (`font-family`) dan palette warna dominan website aktif.
- [ ] **Popup View (`eyedropper-popup.view.ts`)**:
  - Palet warna yang baru saja diambil (color history).
  - Quick-copy warna dan preview font.

---

### 5. 📝 Quick Scratchpad & Snippets
> **Priority:** Low | **Target:** Universal Productivity
- [ ] **Core Service (`scratchpad.service.ts`)**:
  - Manajemen catatan teks bebas dan code snippets favorit.
  - Sinkronisasi instan antar-tab via `StorageService.watch()`.
- [ ] **Popup View (`scratchpad-popup.view.ts`)**:
  - Markdown editor minimalis dengan autosave.
  - Tombol quick-copy snippet (Regex, SQL snippets, email templates).

---

## 🛠️ Modularity Checklist
Setiap modul baru harus mematuhi standar arsitektur **Extensible**:
1. [ ] Ditempatkan di folder `src/modules/<module-id>/`.
2. [ ] Mendefinisikan `ModuleDefinition` dengan `id`, `name`, `description`, dan `icon` SVG.
3. [ ] Mengimplementasikan `PopupViewController` (`mount()` & `unmount()`) untuk UI popup/drawer.
4. [ ] Mendaftarkan service dan controller ke IoC `Container` via `app.module.ts`.
5. [ ] Bebas memory leak (membersihkan interval/listener saat `unmount()` / `suspend()`).
