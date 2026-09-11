import { browser } from "wxt/browser";
import { showNotification } from "@/lib/browser";
import { sendToTab } from "@/lib/messaging";
import { resolveGrants, USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
import type {
  GmHttpRequestDetails,
  GmHttpResponse,
  GmRpcPayload,
  UserScriptRecord,
} from "../types/user-scripts.types";
import { fetchRequire, urlMatches } from "./injection.engine";
import { get, getScriptToken, gmDelete, gmGet, gmList, gmSet } from "./user-scripts.service";

export const MENU_PREFIX = "us_menu_";

export async function handleGmRpc(
  payload: GmRpcPayload,
  tabId: number,
  tabUrl: string,
): Promise<unknown> {
  const { scriptId, fn, args, token } = payload;
  const script = await get(scriptId);
  if (!script?.enabled) throw new Error("Script disabled or missing");

  const expectedToken = getScriptToken(scriptId);
  if (!token || token !== expectedToken) {
    throw new Error(`Unauthorized GM RPC: invalid authentication token for "${script.meta.name}"`);
  }

  if (tabUrl && !urlMatches(script, tabUrl)) {
    throw new Error(`Unauthorized GM RPC: script "${script.meta.name}" is not active on tab URL`);
  }

  const allowedApis = resolveGrants(script.meta.grants);
  const REQUIRED_GRANTS: Record<string, string[]> = {
    gm_xhr: ["GM_xmlhttpRequest", "GM.xmlHttpRequest"],
    gm_download: ["GM_download", "GM.download"],
    gm_get: ["GM_getValue", "GM.getValue"],
    gm_set: ["GM_setValue", "GM.setValue"],
    gm_delete: ["GM_deleteValue", "GM.deleteValue"],
    gm_list: ["GM_listValues", "GM.listValues"],
    gm_watch: ["GM_addValueChangeListener", "GM.addValueChangeListener"],
    gm_clipboard: ["GM_setClipboard", "GM.setClipboard"],
    gm_notify: ["GM_notification", "GM.notification"],
    gm_resource: ["GM_getResourceURL", "GM.getResourceUrl"],
    gm_menu: ["GM_registerMenuCommand", "GM.registerMenuCommand"],
  };
  const required = REQUIRED_GRANTS[fn];
  if (required && !required.some((api) => allowedApis.includes(api))) {
    throw new Error(`Unauthorized: script "${script.meta.name}" lacks @grant for "${fn}"`);
  }

  switch (fn) {
    case "gm_get":
      return { value: await gmGet(scriptId, String(args[0])) };
    case "gm_set": {
      const key = String(args[0]);
      await gmSet(scriptId, key, args[1]);
      await broadcastValueChanged(scriptId, key, args[1], tabId);
      return null;
    }
    case "gm_delete":
      await gmDelete(scriptId, String(args[0]));
      return null;
    case "gm_list":
      return gmList(scriptId);
    case "gm_watch":
      return null;
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

async function broadcastValueChanged(
  scriptId: string,
  key: string,
  value: unknown,
  originTab: number,
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

async function gmXhr(
  script: UserScriptRecord,
  details: GmHttpRequestDetails,
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

export function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h === "169.254.169.254" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  const match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
    if (a === 0) return true;
  }
  return false;
}

function assertConnectAllowed(script: UserScriptRecord, hostname: string): void {
  const allowed = script.meta.connects;
  if (!allowed.length)
    throw new Error(`GM_xmlhttpRequest: no @connect domains listed in ${script.meta.name}`);
  const host = hostname.toLowerCase();
  const isPrivate = isPrivateOrLocalHost(host);

  if (isPrivate) {
    const explicitMatch = allowed.some((c) => c.toLowerCase() === host);
    if (!explicitMatch) {
      throw new Error(
        `GM_xmlhttpRequest: private/loopback host "${hostname}" blocked unless explicitly granted in @connect`,
      );
    }
    return;
  }

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
  return "https://extensible.invalid/";
}

async function gmDownload(
  script: UserScriptRecord,
  details: { url: string; name?: string },
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

async function fetchResourceAsDataUrl(script: UserScriptRecord, name: string): Promise<string> {
  const url = script.meta.resources[name];
  if (!url) throw new Error(`Unknown @resource: ${name}`);
  const text = await fetchRequire(url);
  return `data:text/plain;base64,${arrayBufferToBase64(new TextEncoder().encode(text))}`;
}

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
