/**
 * Background engine (ARC-01..04): injects matching enabled scripts with
 * chrome.scripting.executeScript, serves GM_* RPC from the relay, enforces
 * SEC-04/SEC-05, records run logs, and runs auto-update checks.
 */
import { browser } from "wxt/browser";
import { showNotification } from "@/lib/browser";
import { isFeatureEnabled } from "@/lib/feature-settings";
import { onMessage, sendToTab } from "@/lib/messaging";
import {
  isBlockedUrl,
  resolveGrants,
  USER_SCRIPTS_ACTIONS,
} from "./constants/user-scripts.constants";
import { UserScriptsService } from "./services/user-scripts.service";
import type {
  GmHttpRequestDetails,
  GmHttpResponse,
  GmRpcPayload,
  UserScriptRecord,
  UserScriptRunLogEntry,
} from "./types/user-scripts.types";
import { parseUserScriptHeader } from "./utils/header-parser.utils";

const MENU_PREFIX = "us_menu_";
/** Scripts already injected into a given tab (per navigation). */
const injectedTabs = new Map<number, Set<string>>();
/** @require/@resource targets cached in-memory per session. */
const requireCache = new Map<string, string>();

export function setupUserScriptsBackground(): void {
  // Cache invalidation — must live inside setup(): this module is also bundled
  // into the content script, where `browser.tabs` is undefined.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") injectedTabs.delete(tabId);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    injectedTabs.delete(tabId);
  });

  // ---- Script management routes ----
  onMessage<null, UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST, async () =>
    UserScriptsService.list()
  );

  onMessage<{ id: string }, UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.GET, async (p) =>
    UserScriptsService.get(p?.id ?? "")
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(
    USER_SCRIPTS_ACTIONS.SAVE,
    async (p) => {
      if (!p?.record) throw new Error("Missing record");
      return UserScriptsService.save(p.record);
    }
  );

  onMessage<{ id: string }, boolean>(USER_SCRIPTS_ACTIONS.DELETE, async (p) => {
    const ok = await UserScriptsService.remove(p?.id ?? "");
    if (ok) await reinjectAll();
    return ok;
  });

  onMessage<{ id: string }, UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.DUPLICATE, async (p) =>
    UserScriptsService.duplicate(p?.id ?? "")
  );

  onMessage<{ id: string; index: number }, UserScriptRecord[]>(
    USER_SCRIPTS_ACTIONS.MOVE,
    async (p) => UserScriptsService.move(p?.id ?? "", p?.index ?? 0)
  );

  onMessage<{ id: string; enabled: boolean }, UserScriptRecord[]>(
    USER_SCRIPTS_ACTIONS.TOGGLE,
    async (p) => {
      const all = await UserScriptsService.setEnabled(p?.id ?? "", p?.enabled ?? false);
      await reinjectAll();
      return all;
    }
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(
    USER_SCRIPTS_ACTIONS.IMPORT_FILE,
    async (p) => {
      if (!p?.record) throw new Error("Missing record");
      return UserScriptsService.add(p.record);
    }
  );

  onMessage<null, string>(USER_SCRIPTS_ACTIONS.EXPORT, async () =>
    JSON.stringify(await UserScriptsService.list(), null, 2)
  );

  onMessage<{ url: string }, UserScriptRecord>(USER_SCRIPTS_ACTIONS.INSTALL_FROM_URL, async (p) => {
    const url = p?.url?.trim();
    if (!url) throw new Error("Missing URL");
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const code = await res.text();
    const record = recordFromCode(code);
    await UserScriptsService.add(record);
    await reinjectAll();
    return record;
  });

  onMessage<{ tabId: number }, number>(USER_SCRIPTS_ACTIONS.RUN_IN_TAB, async (p) => {
    const tabId = p?.tabId;
    if (tabId == null) throw new Error("Missing tabId");
    return runScriptsInTab(tabId, "manual");
  });

  onMessage<{ scriptId: string }, void>(USER_SCRIPTS_ACTIONS.OPEN_EDITOR, async (p) => {
    const script = await UserScriptsService.get(p?.scriptId ?? "");
    if (!script) throw new Error("Script not found");
    const url = browser.runtime.getURL("/popup.html#/user-scripts-editor");
    await browser.tabs.create({ url: `${url}?id=${encodeURIComponent(script.id)}` });
  });

  onMessage<{ scriptId: string }, UserScriptRunLogEntry[]>("user_scripts:run_log", async (p) =>
    UserScriptsService.getRunLog(p?.scriptId ?? "")
  );
  // ---- GM RPC bridge (ARC-02) ----
  onMessage<GmRpcPayload, unknown>(USER_SCRIPTS_ACTIONS.GM_RPC, async (p, sender) => {
    if (!p || !sender.tab?.id) throw new Error("Invalid GM RPC");
    return handleGmRpc(p, sender.tab.id, sender.tab.url ?? "");
  });

  // ---- Context menu commands (GM_registerMenuCommand) ----
  browser.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    if (!id.startsWith(MENU_PREFIX)) return;
    const [scriptId, commandId] = id.slice(MENU_PREFIX.length).split(":");
    if (tab?.id == null) return;
    void sendToTab(tab.id, USER_SCRIPTS_ACTIONS.GM_MENU_COMMAND, { scriptId, commandId }).catch(
      () => {}
    );
  });

  // ---- Auto-inject on navigation + manual run ----
  // tabs.onUpdated avoids the extra "webNavigation" permission.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;
    const url = changeInfo.url ?? tab.url ?? "";
    if (!url || isBlockedUrl(url)) return;
    void runScriptsInTab(tabId, "auto", url).catch(() => {});
  });

  // ---- Auto-update checks (@updateURL / @downloadURL) ----
  browser.alarms.create("us_auto_update", { periodInMinutes: 360 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "us_auto_update") return;
    void checkAllUpdates().catch((err) => console.debug("[UserScripts] update tick:", err));
  });
}

// ---- Injection engine ----

/** Runs all matching enabled scripts in a tab. Returns count injected. */
async function runScriptsInTab(
  tabId: number,
  trigger: "auto" | "manual",
  navUrl?: string
): Promise<number> {
  if (!(await isFeatureEnabled("user-scripts"))) return 0;
  const tab = await browser.tabs.get(tabId);
  const url = navUrl ?? tab.url ?? "";
  if (!url || isBlockedUrl(url)) return 0;

  // The ISOLATED-world GM relay is installed by the feature's content script
  // (setupGmRelay runs on every page via the shared <all_urls> content script),
  // so no relay file injection is needed here.
  const scripts = (await UserScriptsService.list()).filter((s) => s.enabled && urlMatches(s, url));

  let count = 0;
  for (const script of scripts) {
    const seen = injectedTabs.get(tabId) ?? new Set<string>();
    if (trigger === "auto" && seen.has(script.id)) continue;

    const ok = await injectScript(tabId, script, url);
    if (ok) count++;
    seen.add(script.id);
    injectedTabs.set(tabId, seen);
  }
  return count;
}

/** Injects a single script with its GM shim; logs the attempt (UI-04). */
async function injectScript(
  tabId: number,
  script: UserScriptRecord,
  url: string
): Promise<boolean> {
  const apis = resolveGrants(script.meta.grants);
  const requires: string[] = [];
  for (const req of script.meta.requires) {
    try {
      requires.push(await fetchRequire(req));
    } catch (err) {
      await UserScriptsService.appendRunLog({
        scriptId: script.id,
        ts: Date.now(),
        url,
        ok: false,
        message: `@require failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const apisForWorld =
    script.meta.injectInto === "page" || apis.includes("unsafeWindow")
      ? apis
      : apis.filter((a) => a !== "unsafeWindow");

  // Compose the executable source (shim + requires + body).
  const { buildScriptSource } = await import("./utils/gm-shim.source");
  const source = buildScriptSource({
    scriptId: script.id,
    apis: apisForWorld,
    requires,
    body: stripHeaderOnly(script.code),
  });

  const world = script.meta.injectInto === "page" ? "MAIN" : "ISOLATED";
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      world,
      injectImmediately: script.meta.runAt === "document-start",
      func: (src: string) => {
        // ARC-01: no eval — new Function keeps CSP safe via the official API.
        // eslint-disable-next-line no-new-func
        new Function(src)().catch((e: unknown) => {
          console.error("[UserScripts] async error:", e);
        });
      },
      args: [source],
    });
    await UserScriptsService.appendRunLog({ scriptId: script.id, ts: Date.now(), url, ok: true });
    await UserScriptsService.save({ ...script, lastRunAt: Date.now() });
    return true;
  } catch (err) {
    await UserScriptsService.appendRunLog({
      scriptId: script.id,
      ts: Date.now(),
      url,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function stripHeaderOnly(code: string): string {
  const end = code.indexOf("// ==/UserScript==");
  if (end < 0) return code;
  return code.slice(end + "// ==/UserScript==".length);
}

/** Re-run matching scripts across open tabs (after toggle/import/delete). */
async function reinjectAll(): Promise<void> {
  const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id == null) continue;
    injectedTabs.delete(tab.id);
    await runScriptsInTab(tab.id, "auto", tab.url ?? undefined).catch(() => {});
  }
}

// ---- URL matching: Chrome match patterns + /regex/ + plain globs ----

export function urlMatches(script: UserScriptRecord, url: string): boolean {
  const { matches, excludes } = script.meta;
  if (!matches.length) return false;
  if (excludes.some((p) => patternToRegex(p).test(url))) return false;
  return matches.some((p) => patternToRegex(p).test(url));
}

function patternToRegex(pattern: string): RegExp {
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    try {
      return new RegExp(pattern.slice(1, -1));
    } catch {
      /* fall through to glob */
    }
  }
  if (/^(\*|http|https|file|ftp):\/\/\*?/.test(pattern) || pattern.includes("://")) {
    // Chrome match pattern: scheme://host/path
    const esc = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "§")
      .replace("§", "(^|[^.]*)") // host wildcard shouldn't cross dots loosely
      .replace(/§/g, ".*");
    try {
      return new RegExp(`^${esc}$`);
    } catch {
      return /$^/;
    }
  }
  // Plain glob
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${esc}$`);
}

// ---- GM RPC dispatch ----

async function handleGmRpc(payload: GmRpcPayload, tabId: number, tabUrl: string): Promise<unknown> {
  const { scriptId, fn, args } = payload;
  const script = await UserScriptsService.get(scriptId);
  if (!script?.enabled) throw new Error("Script disabled or missing");

  switch (fn) {
    case "gm_get":
      return { value: await UserScriptsService.gmGet(scriptId, String(args[0])) };
    case "gm_set": {
      const key = String(args[0]);
      await UserScriptsService.gmSet(scriptId, key, args[1]);
      await broadcastValueChanged(scriptId, key, args[1], tabId);
      return null;
    }
    case "gm_delete":
      await UserScriptsService.gmDelete(scriptId, String(args[0]));
      return null;
    case "gm_list":
      return UserScriptsService.gmList(scriptId);
    case "gm_watch":
      return null; // relay listens via GM_VALUE_CHANGED broadcasts
    case "gm_unwatch":
      return null;
    case "gm_xhr":
      return gmXhr(script, args[0] as GmHttpRequestDetails);
    case "gm_download":
      return gmDownload(script, args[0] as { url: string; name?: string });
    case "gm_clipboard": {
      await navigator.clipboard.writeText(String(args[0] ?? ""));
      return null;
    }
    case "gm_notify": {
      const d = args[0] as { text?: string; title?: string; image?: string };
      showNotification({
        title: d?.title || script.meta.name,
        message: d?.text || "",
        iconUrl: d?.image || script.meta.icon || undefined,
      });
      return null;
    }
    case "gm_resource":
      return { url: await fetchResourceAsDataUrl(script, String(args[0])) };
    case "gm_menu": {
      const caption = String(args[0] ?? "Menu");
      const commandId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      browser.contextMenus.create({
        id: `${MENU_PREFIX}${scriptId}:${commandId}`,
        title: caption,
        contexts: ["page"],
      });
      // Let the relay know the command id so callbacks can be routed.
      await sendToTab(tabId, USER_SCRIPTS_ACTIONS.GM_MENU_REGISTERED, {
        scriptId,
        caption,
        commandId,
      });
      return null;
    }
    case "gm_ping":
      return { url: tabUrl };
    default:
      throw new Error(`Unknown GM function: ${fn}`);
  }
}

/** GM value-change broadcast to every tab except the origin. */
async function broadcastValueChanged(
  scriptId: string,
  key: string,
  value: unknown,
  originTab: number
): Promise<void> {
  const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.id == null || tab.id === originTab) continue;
    void sendToTab(tab.id, USER_SCRIPTS_ACTIONS.GM_VALUE_CHANGED, {
      scriptId,
      key,
      listenerId: 0,
      oldValue: undefined,
      newValue: value,
      remote: true,
    }).catch(() => {});
  }
}

/** GM_xmlhttpRequest: background fetch with @connect enforcement (SEC-04). */
async function gmXhr(
  script: UserScriptRecord,
  details: GmHttpRequestDetails
): Promise<GmHttpResponse> {
  if (!details?.url) throw new Error("GM_xhr: missing url");
  const target = new URL(details.url, locationHrefForBase());
  assertConnectAllowed(script, target.hostname);

  const controller = new AbortController();
  const timer = details.timeout ? setTimeout(() => controller.abort(), details.timeout) : null;
  try {
    const res = await fetch(target.href, {
      method: details.method || "GET",
      headers: details.headers,
      body: details.data,
      signal: controller.signal,
      credentials: "omit",
    });
    const raw = await res.arrayBuffer();
    const wantsBinary = details.responseType === "blob" || details.responseType === "arraybuffer";
    const isBase64 = wantsBinary || !isProbablyText(raw);
    const data = isBase64 ? arrayBufferToBase64(raw) : new TextDecoder().decode(raw);
    return {
      status: res.status,
      statusText: res.statusText,
      responseHeaders: [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\r\n"),
      finalUrl: res.url || target.href,
      data,
      isBase64,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertConnectAllowed(script: UserScriptRecord, hostname: string): void {
  const allowed = script.meta.connects;
  if (!allowed.length)
    throw new Error(`GM_xmlhttpRequest: no @connect domains listed in ${script.meta.name}`);
  const host = hostname.toLowerCase();
  const ok = allowed.some((c) => {
    const pat = c.toLowerCase().replace(/^\*\./, "*");
    if (pat === "*") return true;
    if (pat === host) return true;
    if (pat.startsWith("*")) return host.endsWith(pat.slice(1));
    return false;
  });
  if (!ok) throw new Error(`GM_xmlhttpRequest: domain "${hostname}" not in @connect list`);
}

function locationHrefForBase(): string {
  // Background has no location; relative URLs unsupported by design.
  return "https://extensible.invalid/";
}

async function gmDownload(
  script: UserScriptRecord,
  details: { url: string; name?: string }
): Promise<null> {
  const target = new URL(details.url, locationHrefForBase());
  assertConnectAllowed(script, target.hostname);
  await browser.downloads.download({
    url: target.href,
    filename: details.name?.replace(/[\\/:*?"<>|]/g, "_"),
    saveAs: false,
  });
  return null;
}

async function fetchRequire(url: string): Promise<string> {
  const cached = requireCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const text = await res.text();
  requireCache.set(url, text);
  return text;
}

async function fetchResourceAsDataUrl(script: UserScriptRecord, name: string): Promise<string> {
  const url = script.meta.resources[name];
  if (!url) throw new Error(`Unknown @resource: ${name}`);
  const text = await fetchRequire(url);
  return `data:text/plain;base64,${arrayBufferToBase64(new TextEncoder().encode(text))}`;
}

// ---- Auto-update ----

async function checkAllUpdates(): Promise<void> {
  const scripts = await UserScriptsService.list();
  for (const script of scripts) {
    const updateUrl = script.meta.updateURL || script.meta.downloadURL;
    if (!updateUrl) continue;
    try {
      const res = await fetch(updateUrl, { credentials: "omit" });
      if (!res.ok) continue;
      const code = await res.text();
      const meta = parseUserScriptHeader(code);
      if (compareVersions(meta.version, script.meta.version) > 0) {
        const updated = { ...script, code, updatedAt: Date.now() };
        await UserScriptsService.save(updated);
        showNotification({
          title: "Userscript updated",
          message: `${script.meta.name} → v${meta.version}`,
        });
      }
    } catch {
      // Skip unreachable update hosts silently.
    }
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ---- Small helpers ----

function isProbablyText(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf.slice(0, 800));
  for (const b of bytes) if (b === 0) return false;
  return true;
}

function arrayBufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Builds a fresh record by parsing code (used by install-from-URL and import). */
export function recordFromCode(code: string): UserScriptRecord {
  // Imported in register? No — keep local to avoid cycles; parse here.
  const now = Date.now();
  const meta = parseUserScriptHeader(code);
  return {
    id: `us_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    code,
    meta,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
  };
}
