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
import { UserScriptsService } from "./user-scripts.service";

const injectedTabs = new Map<number, Set<string>>();

const requireCache = new Map<string, string>();

export class InjectionEngine {
  static async runScriptsInTab(
    tabId: number,
    trigger: "auto" | "manual",
    navUrl?: string,
    targetScriptId?: string,
  ): Promise<number> {
    if (!(await isFeatureEnabled("user-scripts"))) return 0;
    const tab = await browser.tabs.get(tabId);
    const url = navUrl ?? tab.url ?? "";
    if (!url || isBlockedUrl(url)) return 0;

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

  static async reinjectAll(): Promise<void> {
    await InjectionEngine.syncUserScriptsApi().catch(() => {});
    const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id == null) continue;
      injectedTabs.delete(tab.id);
      await InjectionEngine.runScriptsInTab(tab.id, "auto", tab.url ?? undefined).catch(() => {});
    }
  }

  static async syncUserScriptsApi(): Promise<void> {
    const userScriptsApi =
      (
        browser as unknown as {
          userScripts?: {
            register: (arg: unknown) => Promise<unknown>;
            unregister: () => Promise<unknown>;
          };
        }
      ).userScripts ??
      (
        globalThis.chrome as unknown as {
          userScripts?: {
            register: (arg: unknown) => Promise<unknown>;
            unregister: () => Promise<unknown>;
          };
        }
      )?.userScripts;
    if (typeof userScriptsApi?.register !== "function") return;

    try {
      if (typeof userScriptsApi.unregister === "function") {
        await userScriptsApi.unregister().catch(() => {});
      }
      const allScripts = await UserScriptsService.list();
      const enabled = allScripts.filter((s) => s.enabled);
      if (!enabled.length) return;

      const items = [];
      for (const script of enabled) {
        const rpcToken = UserScriptsService.getScriptToken(script.id);
        const source = buildScriptSource({
          scriptId: script.id,
          rpcToken,
          apis: resolveGrants(script.meta.grants),
          requires: [],
          body: InjectionEngine.stripHeaderOnly(script.code),
        });
        items.push({
          id: script.id,
          matches: script.meta.matches.length ? script.meta.matches : ["*://*/*"],
          js: [{ code: source }],
          runAt: script.meta.runAt === "document-start" ? "document_start" : "document_idle",
          world: "USER_SCRIPT",
        });
      }
      await userScriptsApi.register(items);
    } catch (err) {
      console.debug("[UserScripts] syncUserScriptsApi error:", err);
    }
  }

  static onTabLoading(tabId: number): void {
    injectedTabs.delete(tabId);
  }

  static forgetTab(tabId: number): void {
    injectedTabs.delete(tabId);
  }

  private static async injectScript(
    tabId: number,
    script: UserScriptRecord,
    url: string,
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

    const rpcToken = UserScriptsService.getScriptToken(script.id);
    await sendToTab(tabId, USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN, {
      scriptId: script.id,
      token: rpcToken,
    }).catch(() => {});

    const source = buildScriptSource({
      scriptId: script.id,
      rpcToken,
      apis: apisForWorld,
      requires,
      body: InjectionEngine.stripHeaderOnly(script.code),
    });

    try {
      const userScriptsApi =
        (browser as unknown as { userScripts?: { execute: (arg: unknown) => Promise<unknown> } })
          .userScripts ??
        (
          globalThis.chrome as unknown as {
            userScripts?: { execute: (arg: unknown) => Promise<unknown> };
          }
        )?.userScripts;
      if (typeof userScriptsApi?.execute === "function") {
        await userScriptsApi.execute({
          target: { tabId },
          js: [{ code: source }],
        });
        await UserScriptsService.appendRunLog({
          scriptId: script.id,
          ts: Date.now(),
          url,
          ok: true,
        });
        await UserScriptsService.save({ ...script, lastRunAt: Date.now() });
        return true;
      }
    } catch (e) {
      console.debug("[UserScripts] chrome.userScripts.execute fallback:", e);
    }

    const world = "MAIN";
    try {
      if (typeof browser.scripting?.executeScript === "function") {
        const results = await browser.scripting.executeScript({
          target: { tabId },
          world,
          injectImmediately: script.meta.runAt === "document-start",
          func: (src: string) => {
            try {
              const el = document.createElement("script");
              el.textContent = src;
              (document.head || document.documentElement).appendChild(el);
              el.remove();
              return { ok: true };
            } catch {
              try {
                const run = new Function(src);
                run();
                return { ok: true };
              } catch (evalErr) {
                const msg = evalErr instanceof Error ? evalErr.message : String(evalErr);
                console.error("[UserScripts] execute error:", evalErr);
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

  private static stripHeaderOnly(code: string): string {
    const end = code.indexOf("// ==/UserScript==");
    if (end < 0) return code;
    return code.slice(end + "// ==/UserScript==".length);
  }

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
