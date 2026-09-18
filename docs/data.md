# Stored data inventory

What Extensible keeps, where it lives, and how to get rid of it. Keep this file
in sync when a feature adds a storage key — `npx knip` will not catch drift here.

## Nothing leaves the machine

The extension has **no telemetry, no analytics, and no CDN assets**. The only
outbound requests are the ones a feature needs:

| Destination | Why | Feature |
| --- | --- | --- |
| `https://api.tempmail.ing/*` | create/read/delete disposable inboxes | Temp Mail |
| the site you are on | content scripts read the page DOM to build the dock, badges and chat exports | Quick Dock, Temp Mail, AI Toolkit |

Chat text, email bodies and script sources are never sent anywhere else.

## Persistent area (`browser.storage.local`)

Survives browser restarts. Visible to anyone who can read the browser profile.

| Key | Contents | Cap |
| --- | --- | --- |
| `feature_settings` | per-module on/off map | one boolean per module |
| `temp_mail:state` | current address, expiry, unread count | single record |
| `temp_mail:inbox` | cached inbox — **contains message bodies, including OTP codes** | 30 messages |
| `temp_mail:settings` | `showFloatingButton` | single record |
| `ai_toolkit_history` | export metadata only (title, platform, message count, date, format, URL) — **never the transcript** | 50 entries |
| `ai_toolkit_caveman` | Caveman mode on/off, level, per-site overrides | single record |
| `user_scripts:list` | userscript metadata **and source code** | unbounded, guarded by the local quota |
| `user_scripts:gm_values` | whatever scripts passed to `GM_setValue` — may contain tokens | 256 keys / 64 KB per value / 512 KB per script |
| `user_scripts:run_logs` | last run result per script | 30 entries per script |

## Session area (`browser.storage.session`)

Cleared by the browser when it closes — the point of keeping transcripts here.

| Key | Contents | Cap |
| --- | --- | --- |
| `ai_toolkit_history_blob:<id>` | the exported transcript for one history entry | 50, dropped with its index entry |

Older builds stored the transcript inside the persistent index. The first read
after upgrading migrates those blobs into the session area and strips `content`
from the index, so an old profile also ends up with nothing readable at rest.

## In-page data

The dock, mail badge and composer toolbar render inside shadow roots under
`ext-*-host` elements plus a shared adopted stylesheet per document. The
document itself is left untouched apart from those hosts; no data is written
to the page or to `localStorage` of the site you are visiting.

## Permissions

| Permission | Used for |
| --- | --- |
| `<all_urls>` | content scripts on any site; the mail API is covered by it |
| `storage`, `unlimitedStorage` | the tables above (quota kept generous so a script save cannot fail mid-write) |
| `scripting` | injecting userscripts and the popup's scrape fallback |
| `userScripts` | the MV3 userscript runner |
| `tabs` | finding the active tab to talk to its content script |
| `alarms` | the mail inbox poll |
| `contextMenus` | "copy address / autofill email / open inbox" menu items |
| `clipboardWrite` | copying addresses, OTP codes and chat exports |
| `downloads`, `notifications` | saving exports, install/update notices |

## Removing everything

Popup → trash button (top right of the module list) clears both storage areas
after a confirmation. It is the manual equivalent of an uninstall, so it also
drops module toggles and userscripts — the confirm text names each of them.

Programmatically: `clearAllStoredData()` in `src/lib/utils.ts`.

## Threat model in one line

Everything here is readable by anything that can read the Chrome profile, so the
only real protections are: nothing sensitive is persisted when it does not have
to be (transcripts live in the session area), nothing sensitive is logged
(hit counts and platform names only), and email HTML is sanitised before it is
rendered (scripts, frames, `blob:`/`filesystem:` URLs and remote images are
blocked unless you opt in).
