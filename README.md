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

## Architecture: one kernel, self-registering modules

Every module lives in its own folder and follows the same layout. Nothing is
registered by hand: `src/features/index.ts` globs `*/register.ts`, and each
module calls `defineFeature()` with its id, icon, colour and entry points.

```
src/
├─ entrypoints/        MV3 surfaces: background, content, popup
├─ features/<id>/      one folder per module
│  ├─ register.ts        defineFeature(): id, name, icon, colour, entries
│  ├─ background.ts      setupBackground() — service-worker wiring
│  ├─ content.ts         setupContent() — injected page wiring (≤40 lines)
│  ├─ constants/         actions + storage keys, one prefix per module
│  ├─ types/             the module's data shapes
│  ├─ services/          storage access and business logic
│  ├─ utils/             pure helpers — the part testable without a browser
│  └─ components/        Svelte UI, shared by popup and dock
├─ lib/               kernel: messaging, feature registry & toggles, theme,
│                     shadow UI, browser helpers, icon set, design tokens
├─ components/        shared Svelte UI (Button, Card, Toggle, EmptyState, …)
└─ styles/global.css  design tokens + light/dark palette
```

A module never imports another module's internals. Cross-module needs go
through `features/<id>/api.ts`, so internal refactors cannot break a caller.
The dock and the popup render the same component: a module UI works in both
surfaces without duplicating a line.

### Contracts the tooling enforces

| Command | Contract |
| --- | --- |
| `pnpm gen <id>` | scaffolds the layout above; output is already formatted and passes knip |
| `pnpm check:structure` | module layout, runner names (`setupBackground`/`setupContent`), storage/action prefixes, thin content scripts, no hardcoded URLs, no dead `views/` or `content/` folders |
| `pnpm knip` | no unused files or exports anywhere |
| `pnpm test` | parser fixtures per AI site, unit assertions, and a light/dark contrast gate |
| `pnpm lint` | biome: formatting, lint, import order |
| `pnpm check` | svelte-check: 0 errors, 0 warnings |

## Active Modules

| Module | What it does |
| --- | --- |
| **Quick Dock** `side-notch` *(mandatory)* | the in-page hub: bento launcher, module detail view, keyboard shortcuts |
| **AI Toolkit** `ai-toolkit` | exports the chat you are reading as Markdown / HTML / JSON / PDF, plus Caveman mode for prompt style |
| **Temp Mail** `temp-mail` | disposable address, live inbox with OTP reader, autofill badge on any email field |
| **User Scripts** `user-scripts` | Tampermonkey-style engine: GM_* APIs, per-script storage with caps, run log |
| **YouTube** `youtube` | paste a link and play it in a floating window over the hub — drag it anywhere, resize from the corner, and it keeps playing after you close the hub |

### Module settings

A module declares its settings once, as a schema in `src/features/<id>/settings.ts`
(field kind, label, hint, and a `read`/`write` pair over its own storage). The hub
renders every schema with one shared screen — the gear button in a module's detail
header — so no module hand-builds its own settings UI. A setting that is not
declared there does not exist in the UI.

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

- **WXT + Svelte 5**: one build for chrome/firefox/edge, runes (`$state`/`$derived`/`$effect`) for UI, HMR while developing.
- **TypeScript strict**: `pnpm typecheck` (`tsc --noEmit`) plus `svelte-check` for the Svelte side.
- **pnpm 10 / Node >= 20**: see `packageManager` and `engines` in `package.json`.
- **Gates before a commit**: `pnpm check:structure && pnpm knip && pnpm test && pnpm lint && pnpm check`.

### Getting Started

```bash
# Install dependencies (requires Node >=20 and pnpm 10)
corepack enable
pnpm install

pnpm dev          # Chrome dev build with HMR
pnpm build:all    # chrome + firefox + edge into .output/
pnpm test         # parser fixtures + unit/contrast assertions
```

Then load `.output/chrome-mv3` as an unpacked extension in Chrome
(`chrome://extensions/` → *Load unpacked*).

### Adding a module

```bash
pnpm gen my-module --icon play --color "#C2185B"
```

The generator writes a module that already compiles, lints and passes knip: a
registered feature (it shows up in the hub immediately), an example background
action, a storage-backed service and a component wired to both. Flags:
`--no-content` skips the content script, `--api` adds the cross-module API file.


---
<div align="center">
  <i>Built with absolute precision.</i>
</div>