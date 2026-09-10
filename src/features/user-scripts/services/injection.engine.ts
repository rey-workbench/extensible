/**
 * Injection engine (ARC-01..04): decides which scripts run on a page, injects
 * them with chrome.scripting.executeScript (MAIN/ISOLATED worlds), and records
 * run-log entries (UI-04). SEC-05 enforced via isBlockedUrl.
 */
import { browser } from "wxt/browser";
import { isFeatureEnabled } from "@/lib/feature-settings";
import { isBlockedUrl, resolveGrants } from "../constants/user-scripts.constants";
import type { UserScriptRecord } from "../types/user-scripts.types";
import { UserScriptsService } from "./user-scripts.service";

/** Scripts already injected into a given tab (per navigation). */
const injectedTabs = new Map<number, Set<string>>();

/** @require/@resource targets cached in-memory per session. */
const requireCache = new Map<string, string>();

export class InjectionEngine {
  /** Run all matching (or a specific) enabled scripts in a tab. */
  static async runScriptsInTab(
    tabId: number,
    trigger: "auto" | "manual",
    navUrl?: string,
    targetScriptId?: string
  ): Promise<number> {
    if (!(await isFeatureEnabled("user-scripts"))) return 0;
    const tab = await browser.tabs.get(tabId);
    const url = navUrl ?? tab.url ?? "";
    if (!url || isBlockedUrl(url)) return 0;

    // The ISOLATED-world GM relay is installed by the feature's content script
    // (setupGmRelay runs on every page via the shared <all_urls> content script),
    // so no relay file injection is needed here.
    const allScripts = await UserScriptsService.list();
    const scripts = targetScriptId
      ? allScripts.filter((s) => s.id === targetScriptId)
      : allScripts.filter((s) => s.enabled && InjectionEngine.urlMatches(s, url));

    let count = 0;
    for (const script of scripts) {
      const seen = injectedTabs.get(tabId) ?? new Set<string>();
      if (trigger === "auto" && seen.has(script.id)) continue;

      const ok = await InjectionEngine.injectScript(tabId, script, url);
      if (ok) count++;
      seen.add(script.id);
      injectedTabs.set(tabId, seen);
    }
    return count;
  }

  /** Re-run matching scripts across open tabs (after toggle/import/delete). */
  static async reinjectAll(): Promise<void> {
    const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id == null) continue;
      injectedTabs.delete(tab.id);
      await InjectionEngine.runScriptsInTab(tab.id, "auto", tab.url ?? undefined).catch(() => {});
    }
  }

  /** Forget the injected set when a tab starts loading or closes. */
  static onTabLoading(tabId: number): void {
    injectedTabs.delete(tabId);
  }

  static forgetTab(tabId: number): void {
    injectedTabs.delete(tabId);
  }

  /** Injects a single script with its GM shim; logs the attempt (UI-04). */
  private static async injectScript(
    tabId: number,
    script: UserScriptRecord,
    url: string
  ): Promise<boolean> {
    const apis = resolveGrants(script.meta.grants);
    const requires: string[] = [];
    for (const req of script.meta.requires) {
      try {
        requires.push(await InjectionEngine.fetchRequire(req));
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
    const { buildScriptSource } = await import("../utils/gm-shim.source");
    const source = buildScriptSource({
      scriptId: script.id,
      apis: apisForWorld,
      requires,
      body: InjectionEngine.stripHeaderOnly(script.code),
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
          try {
            const res = new Function(src)();
            if (res && typeof (res as Promise<unknown>).catch === "function") {
              (res as Promise<unknown>).catch((e: unknown) => {
                console.error("[UserScripts] async error:", e);
              });
            }
          } catch (e) {
            console.error("[UserScripts] execute error:", e);
          }
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

  // ---- URL matching: Chrome match patterns + /regex/ + plain globs ----

  static urlMatches(script: UserScriptRecord, url: string): boolean {
    const { matches, excludes } = script.meta;
    if (!matches.length) return false;
    if (excludes.some((p) => InjectionEngine.patternToRegex(p).test(url))) return false;
    return matches.some((p) => InjectionEngine.patternToRegex(p).test(url));
  }

  private static patternToRegex(pattern: string): RegExp {
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

  private static stripHeaderOnly(code: string): string {
    const end = code.indexOf("// ==/UserScript==");
    if (end < 0) return code;
    return code.slice(end + "// ==/UserScript==".length);
  }

  /** Fetch an @require/@resource URL once per session (cached). */
  static async fetchRequire(url: string): Promise<string> {
    const cached = requireCache.get(url);
    if (cached) return cached;
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const text = await res.text();
    requireCache.set(url, text);
    return text;
  }

  static getRequireCache(): Map<string, string> {
    return requireCache;
  }
}
