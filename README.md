<div align="center">
  <img src="assets/icons/icon-128.png" alt="Extensible Logo" width="128"/>
  <h1>Extensible</h1>
  <p><strong>The extension makes you possible.</strong></p>
  <p>A modular, hyper-optimized productivity suite built on a pristine Clean Architecture kernel.</p>
</div>

---

## Why Extensible?

Modern workflows are chaotic. You jump between tabs, open a dozen single-purpose extensions, and lose focus switching contexts. **Extensible** flips the paradigm. It provides a unified, pluggable architecture where powerful mini-applications live inside one cohesive extension. 

It is fast, it is clean, and it adapts to what you need.

## Architecture: The Kernel & The Modules

Extensible is engineered like a micro-OS inside your browser. 
It uses a strict **Clean Architecture (NestJS-inspired IoC Container)** to completely decouple core platform capabilities from feature domains.

- **`core/` (Kernel)**: The robust foundation. Handles Dependency Injection (`Container`), `MessageRouterService` for cross-context IPC, `StorageService`, and `EventBusService`. Zero domain logic allowed.
- **`shared/` (Commons)**: Pure app-wide constants and configurations.
- **`modules/` (Plugins)**: Isolated feature domains. Modules drop into the framework autonomously, registering their own UI, Background Controllers, and Content Script listeners.

## Active Modules

### Temp Mail (In-Context Disposable Emails)
Don't break your flow to sign up for a newsletter or test an auth flow.
- **Instant Generation**: Generate a disposable email address directly from the popup or the in-page Side-Notch drawer.
- **Inline Autofill**: Detects email fields (`<input type="email">`) and injects a smart badge right into the DOM. One click autofills the generated address.
- **Live Inbox & OTP Reader**: Emails stream directly into your extension popup. Smart heuristics automatically extract OTP codes and verification links so you don't even have to open the email body.
- **Secure Sandbox**: Email bodies are rendered inside an opaque, heavily restricted iframe to prevent XSS and HTML injections.

## Roadmap: Expanding the Ecosystem

The `Extensible` framework is built for growth. Upcoming modules in the pipeline:

- **Fake Identity Generator**: Instantly spawn cohesive test data (Names, Addresses, Phones, Credit Cards) and autofill forms.
- **2FA / TOTP Authenticator**: Scan QR codes from the screen and generate rolling 6-digit tokens without reaching for your phone.
- **JWT & JSON Inspector**: Intercept and beautifully format/decode JWT tokens and JSON payloads directly from your clipboard or network requests.
- **Eyedropper & Asset Sniffer**: Pick colors natively from any pixel on the viewport, detect DOM typography (`font-family`), and maintain a unified color history.
- **Quick Scratchpad**: A synchronized, markdown-enabled scratchpad for code snippets and quick notes.

## Development

Built for developers who care about code quality:
- **TypeScript Strict**: 100% type coverage.
- **Esbuild**: Ultra-fast bundling, spitting out lean, minified assets.
- **Zero-Dependency Core UI**: No React, no Vue. Hand-crafted, highly optimized DOM manipulation for sub-millisecond render times.

### Getting Started

```bash
# Install dependencies
npm install

# Run typecheck
npm run typecheck

# Build the extension
npm run build
```

Then, load the `dist/` directory as an Unpacked Extension in Chrome (`chrome://extensions/`).

---
<div align="center">
  <i>Built with absolute precision.</i>
</div>