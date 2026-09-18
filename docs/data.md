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
| `app:theme` | `system` \| `light` \| `dark` — the appearance choice | single string |
| `feature_settings` | per-module on/off map | one boolean per module |
| `temp_mail:state` | current address, expiry, unread count | single record |
| `temp_mail:inbox` | cached inbox — **contains message bodies, including OTP codes** | 30 messages |
| `temp_mail:settings` | `showFloatingButton` | single record |
| `temp_mail:retry` | provider cooldown: end time, kind, consecutive count, one-line reason — no message content | single record |
| `ai_toolkit_history` | export metadata only (title, platform, message count, date, format, URL) — **never the transcript** | 50 entries |
| `ai_toolkit_caveman` | Caveman mode on/off, level, per-site overrides | single record |
| `user_scripts:list` | userscript metadata **and source code** | unbounded, guarded by the local quota |
| `user_scripts:gm_values` | whatever scripts passed to `GM_setValue` — may contain tokens | 256 keys / 64 KB per value / 512 KB per script |
| `user_scripts:run_logs` | last run result per script | 30 entries per script |

### When the mail provider says no

`api.tempmail.ing` sits behind Cloudflare, and a block answers with a full HTML
interstitial. That page is never rendered and never logged: it is reduced to one
sentence plus a wait, and the raw body is capped at 2 KB and kept on the error
object for debugging only. The wait starts at 60s and escalates (5m, 15m, 30m,
1h) while failures keep repeating, honours a `Retry-After` header when one is
present, and is persisted in `temp_mail:retry` because an MV3 background is torn
down between events — an in-memory flag would be forgotten and every wake-up
would knock into the same ban again. Both the popup and the dock render it as an
inbox banner and refuse to call the provider until it expires.

## Session area (`browser.storage.session`)

Cleared by the browser when it closes — the point of keeping transcripts here.

| Key | Contents | Cap |
| --- | --- | --- |
| `ai_toolkit_history_blob:<id>` | the exported transcript for one history entry | 50, dropped with its index entry |

Older builds stored the transcript inside the persistent index. The first read
after upgrading migrates those blobs into the session area and strips `content`
from the index, so an old profile also ends up with nothing readable at rest.

## Appearance

`app:theme` is the only piece of UI state in storage: the popup header cycles
System → Light → Dark. Every palette entry is one `light-dark(light, dark)`
declaration in `global.css`, and the choice is applied as the used value of
`color-scheme` — inline on the popup's `<html>` and on each shadow host, because
our hosts set `style.all = "initial"`, which would reset a `:host` rule. A
browser without `light-dark()` keeps the light palette in `@theme` and simply
has no theme switch.

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
