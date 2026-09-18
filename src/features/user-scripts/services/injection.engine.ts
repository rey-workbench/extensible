import { browser } from "wxt/browser";
import { isFeatureEnabled } from "@/lib/feature-settings";
import { sendToTab } from "@/lib/messaging";
import {
  isBlockedUrl,
  resolveGrants,
  USER_SCRIPTS_ACTIONS,
} from "../constants/user-scripts.constants";
import type { UserScriptRecord } from "../types/user-scripts.types";
import { buildScriptSource } from "../utils/gm-shim.source";
import { appendRunLog, getScriptToken, list, updateLastRun } from "./user-scripts.service";

const injectedTabs = new Map<number, Set<string>>();
const nativeRegisteredScriptIds = new Set<string>();

const requireCache = new Map<string, string>();

interface UserScriptsApi {
  register?: (items: unknown[]) => Promise<unknown>;
  unregister?: () => Promise<unknown>;
  configureWorld?: (opts: unknown) => Promise<unknown>;
}

function getUserScriptsApi(): UserScriptsApi | undefined {
  return (
    (browser as unknown as { userScripts?: UserScriptsApi }).userScripts ??
    (globalThis.chrome as unknown as { userScripts?: UserScriptsApi } | undefined)?.userScripts
  );
}

// ponytail: lastRunAt write throttle (60s) so every auto-run doesn't rewrite storage + trigger UI watch
const lastRunSavedAt = new Map<string, number>();

async function markRun(script: UserScriptRecord): Promise<void> {
  const now = Date.now();
  if (now - (lastRunSavedAt.get(script.id) ?? 0) < 60_000) return;
  lastRunSavedAt.set(script.id, now);
  await updateLastRun(script.id, now);
}

export async function runScriptsInTab(
  tabId: number,
  trigger: "auto" | "manual",
  navUrl?: string,
  targetScriptId?: string,
): Promise<number> {
  if (!(await isFeatureEnabled("user-scripts"))) return 0;
  const tab = await browser.tabs.get(tabId);
  const url = navUrl ?? tab.url ?? "";
  if (!url || isBlockedUrl(url)) return 0;

  const allScripts = await list();
  const scripts = targetScriptId
    ? allScripts.filter((s) => s.id === targetScriptId)
    : allScripts.filter((s) => s.enabled && urlMatches(s, url));

  let count = 0;
  for (const script of scripts) {
    const seen = injectedTabs.get(tabId) ?? new Set<string>();
    if (trigger === "auto" && seen.has(script.id)) continue;

    // If auto-triggered on navigation and this script was registered natively,
    // Chrome's userScripts runner already injected it into USER_SCRIPT world.
    if (trigger === "auto" && nativeRegisteredScriptIds.has(script.id)) {
      continue;
    }

    const ok = await injectScript(tabId, script, url);
    if (ok) count++;
    seen.add(script.id);
    injectedTabs.set(tabId, seen);
  }
  return count;
}

export async function reinjectAll(): Promise<void> {
  void syncUserScriptsApi().catch(() => {});
  try {
    const activeTabs = await browser.tabs.query({
      active: true,
      url: ["http://*/*", "https://*/*"],
    });
    for (const tab of activeTabs) {
      if (tab.id == null) continue;
      injectedTabs.delete(tab.id);
      void runScriptsInTab(tab.id, "auto", tab.url ?? undefined).catch(() => {});
    }
  } catch (err) {
    console.debug("[UserScripts] reinjectAll error:", err);
  }
}

function cleanMatchPattern(pattern: string): string {
  const p = pattern.trim();
  if (p === "<all_urls>") return p;
  const clean = p.split("?")[0].split("#")[0];
  if (/^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*]+)(\/.*)$/.test(clean)) {
    return clean;
  }
  return "*://*/*";
}

async function prepareScriptPayload(
  script: UserScriptRecord,
  forWorld?: "MAIN" | "ISOLATED",
): Promise<{ source: string; rpcToken: string }> {
  const rpcToken = getScriptToken(script.id);
  const requires: string[] = [];
  for (const req of script.meta.requires || []) {
    try {
      requires.push(await fetchRequire(req));
    } catch (err) {
      console.warn(`[UserScripts] @require failed for ${req}:`, err);
    }
  }

  const allApis = resolveGrants(script.meta.grants);
  const apis =
    forWorld === "ISOLATED"
      ? allApis.filter((a) => a !== "unsafeWindow")
      : allApis;

  const source = buildScriptSource({
    scriptId: script.id,
    rpcToken,
    apis,
    requires,
    body: stripHeaderOnly(script.code),
  });

  return { source, rpcToken };
}

export async function syncUserScriptsApi(): Promise<void> {
  const userScriptsApi = getUserScriptsApi();
  if (typeof userScriptsApi?.register !== "function") return;

  try {
    if (typeof userScriptsApi.configureWorld === "function") {
      await userScriptsApi.configureWorld({ messaging: true }).catch(() => {});
    }
    if (typeof userScriptsApi.unregister === "function") {
      await userScriptsApi.unregister().catch(() => {});
    }
    nativeRegisteredScriptIds.clear();

    const allScripts = await list();
    const enabled = allScripts.filter((s) => s.enabled);
    if (!enabled.length) return;

    for (const script of enabled) {
      try {
        const { source } = await prepareScriptPayload(script);
        const rawMatches =
          Array.isArray(script.meta?.matches) && script.meta.matches.length
            ? script.meta.matches
            : ["*://*/*"];
        const matches = rawMatches.map(cleanMatchPattern);

        await userScriptsApi.register([
          {
            id: script.id,
            matches,
            js: [{ code: source }],
            runAt:
              script.meta.runAt === "document-start"
                ? "document_start"
                : "document_idle",
            world: "USER_SCRIPT",
          },
        ]);

        nativeRegisteredScriptIds.add(script.id);
      } catch (scriptErr) {
        console.warn(
          `[UserScripts] Failed to register script ${script.id} natively:`,
          scriptErr,
        );
      }
    }
  } catch (err) {      console.debug("[UserScripts] syncUserScriptsApi error:", err);
  }
}

export function forgetTab(tabId: number): void {
  injectedTabs.delete(tabId);
}

async function injectScript(
  tabId: number,
  script: UserScriptRecord,
  url: string,
): Promise<boolean> {
  const needsMainWorld =
    script.meta.injectInto === "page" ||
    resolveGrants(script.meta.grants).includes("unsafeWindow");
  const world = needsMainWorld ? "MAIN" : "ISOLATED";

  const { source, rpcToken } = await prepareScriptPayload(script, world);

  await sendToTab(tabId, USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN, {
    scriptId: script.id,
    token: rpcToken,
  }).catch(() => {});

  try {
    if (typeof browser.scripting?.executeScript === "function") {
      const results = await browser.scripting.executeScript({
        target: { tabId },
        world,
        injectImmediately: script.meta.runAt === "document-start",
        func: (src: string) => {
          try {
            const el = document.createElement("script");
            const nonceEl = document.querySelector("script[nonce]");
            const nonce =
              nonceEl?.getAttribute("nonce") ||
              (nonceEl as HTMLScriptElement | null)?.nonce;
            if (nonce) {
              el.setAttribute("nonce", nonce);
              el.nonce = nonce;
            }

            let trustedCode: unknown = src;
            const tt = (
              window as unknown as {
                trustedTypes?: {
                  defaultPolicy?: { createScript: (s: string) => unknown };
                  createPolicy?: (
                    name: string,
                    rules: unknown,
                  ) => { createScript: (s: string) => unknown };
                };
              }
            ).trustedTypes;

            if (tt) {
              try {
                if (tt.defaultPolicy) {
                  trustedCode = tt.defaultPolicy.createScript(src);
                } else if (typeof tt.createPolicy === "function") {
                  const policy = tt.createPolicy("extensible-runner", {
                    createScript: (s: string) => s,
                  });
                  trustedCode = policy.createScript(src);
                }
              } catch {}
            }

            try {
              (el as unknown as { textContent: unknown }).textContent =
                trustedCode;
            } catch {
              try {
                (el as unknown as { text: unknown }).text = trustedCode;
              } catch {
                el.appendChild(document.createTextNode(src));
              }
            }

            (document.head || document.documentElement).appendChild(el);
            el.remove();
            return { ok: true };
          } catch (domErr) {
            try {
              const run = new Function(src);
              run();
              return { ok: true };
            } catch (evalErr) {
              const msg =
                domErr instanceof Error
                  ? domErr.message
                  : evalErr instanceof Error
                    ? evalErr.message
                    : "Execution blocked by page CSP / TrustedTypes";
              console.error("[UserScripts] execute error:", msg);
              return { ok: false, error: msg };
            }
          }
        },
        args: [source],
      });
      const res = results?.[0]?.result as { ok?: boolean; error?: string } | undefined;
      if (res && res.ok === false) {
        throw new Error(res.error || "Execution failed in page context");
      }
    } else if (
      typeof (
        browser.tabs as unknown as {
          executeScript?: (...args: unknown[]) => unknown;
        }
      )?.executeScript === "function"
    ) {
      await (
        browser.tabs as unknown as {
          executeScript: (
            id: number,
            details: { code: string; runAt?: string },
          ) => Promise<unknown>;
        }
      ).executeScript(tabId, {
        code: `(() => {
          try {
            const el = document.createElement("script");
            el.textContent = ${JSON.stringify(source)};
            (document.head || document.documentElement).appendChild(el);
            el.remove();
          } catch (err) {
            console.error("[UserScripts] Firefox script injection error:", err);
          }
        })();`,
        runAt: script.meta.runAt === "document-start" ? "document_start" : "document_idle",
      });
    } else {
      throw new Error("Neither browser.scripting nor browser.tabs.executeScript available");
    }

    await appendRunLog({ scriptId: script.id, ts: Date.now(), url, ok: true });
    await markRun(script);
    return true;
  } catch (err) {
    await appendRunLog({
      scriptId: script.id,
      ts: Date.now(),
      url,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function urlMatches(script: UserScriptRecord, url: string): boolean {
  const matches = Array.isArray(script.meta?.matches) ? script.meta.matches : [];
  const excludes = Array.isArray(script.meta?.excludes) ? script.meta.excludes : [];
  if (!matches.length) return false;
  if (excludes.some((p) => patternToRegex(p).test(url))) return false;
  return matches.some((p) => patternToRegex(p).test(url));
}

function patternToRegex(pattern: string): RegExp {
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    try {
      return new RegExp(pattern.slice(1, -1));
    } catch {}
  }
  if (/^(\*|http|https|file|ftp):\/\/\*?/.test(pattern) || pattern.includes("://")) {
    const esc = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "§")
      .replace("§", "(^|[^.]*)")
      .replace(/§/g, ".*");
    try {
      return new RegExp(`^${esc}$`);
    } catch {
      return /$^/;
    }
  }
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${esc}$`);
}

function stripHeaderOnly(code: string): string {
  const end = code.indexOf("// ==/UserScript==");
  if (end < 0) return code;
  return code.slice(end + "// ==/UserScript==".length);
}

export async function fetchRequire(url: string): Promise<string> {
  const cached = requireCache.get(url);
  if (cached) return cached;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const text = await res.text();
  requireCache.set(url, text);
  return text;
}
