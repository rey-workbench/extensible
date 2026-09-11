/**
 * UserScripts background wiring (ARC-01..04): message routes, tab lifecycle
 * listeners, context menu commands, auto-update alarm. Heavy lifting lives in
 * services/injection.engine.ts, services/gm-rpc.service.ts, and
 * services/update.service.ts.
 */
import { browser } from "wxt/browser";
import { onMessage, sendToTab } from "@/lib/messaging";
import { isBlockedUrl, USER_SCRIPTS_ACTIONS } from "./constants/user-scripts.constants";
import { GmRpcService, MENU_PREFIX } from "./services/gm-rpc.service";
import { InjectionEngine } from "./services/injection.engine";
import { UpdateService } from "./services/update.service";
import { recordFromCode, UserScriptsService } from "./services/user-scripts.service";
import type {
  GmRpcPayload,
  UserScriptRecord,
  UserScriptRunLogEntry,
} from "./types/user-scripts.types";

export function setupUserScriptsBackground(): void {
  // Sync scripts to native chrome.userScripts API on startup
  void InjectionEngine.syncUserScriptsApi().catch(() => {});

  // Cache invalidation — must live inside setup(): this module is also bundled
  // into the content script, where `browser.tabs` is undefined.
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") InjectionEngine.onTabLoading(tabId);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    InjectionEngine.forgetTab(tabId);
  });

  // ---- Script management routes ----
  onMessage<null, UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST, async () =>
    UserScriptsService.list()
  );

  onMessage<{ id: string }, UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.GET, async (p) =>
    UserScriptsService.get(p?.id ?? "")
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(USER_SCRIPTS_ACTIONS.SAVE, (p) => {
    if (!p?.record) throw new Error("Missing record");
    return UserScriptsService.save(p.record);
  });

  onMessage<{ id: string }, boolean>(USER_SCRIPTS_ACTIONS.DELETE, async (p) => {
    const ok = await UserScriptsService.remove(p?.id ?? "");
    if (ok) await InjectionEngine.reinjectAll();
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
      await InjectionEngine.reinjectAll();
      return all;
    }
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(
    USER_SCRIPTS_ACTIONS.IMPORT_FILE,
    (p) => {
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
    const record = recordFromCode(await res.text());
    await UserScriptsService.add(record);
    await InjectionEngine.reinjectAll();
    return record;
  });

  onMessage<{ tabId?: number; scriptId?: string }, number>(
    USER_SCRIPTS_ACTIONS.RUN_IN_TAB,
    async (p, sender) => {
      let tabId = p?.tabId ?? sender.tab?.id;
      if (tabId == null) {
        const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        tabId = active?.id;
        if (tabId == null) {
          const [fallback] = await browser.tabs.query({ active: true });
          tabId = fallback?.id;
        }
      }
      if (tabId == null) throw new Error("No active tab");
      return InjectionEngine.runScriptsInTab(tabId, "manual", undefined, p?.scriptId);
    }
  );

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
  onMessage<GmRpcPayload, unknown>(USER_SCRIPTS_ACTIONS.GM_RPC, (p, sender) => {
    if (!p || !sender.tab?.id) throw new Error("Invalid GM RPC");
    return GmRpcService.handle(p, sender.tab.id, sender.tab.url ?? "");
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
    void InjectionEngine.runScriptsInTab(tabId, "auto", url).catch(() => {});
  });

  // ---- Auto-update checks (@updateURL / @downloadURL) ----
  browser.alarms.create("us_auto_update", { periodInMinutes: 360 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "us_auto_update") return;
    void UpdateService.checkAll().catch((err) => console.debug("[UserScripts] update tick:", err));
  });
}
