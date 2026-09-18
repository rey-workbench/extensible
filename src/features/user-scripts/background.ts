import { browser } from "wxt/browser";
import { APP_ACTIONS } from "@/lib/browser";
import { onMessage, sendToTab } from "@/lib/messaging";
import { isBlockedUrl, USER_SCRIPTS_ACTIONS } from "./constants/user-scripts.constants";
import { handleGmRpc, MENU_PREFIX } from "./services/gm-rpc.service";
import {
  forgetTab,
  reinjectAll,
  runScriptsInTab,
  syncUserScriptsApi,
} from "./services/injection.engine";
import { checkAll } from "./services/update.service";
import {
  duplicate,
  getAllScriptTokens,
  getRunLog,
  list,
  move,
  remove,
  save,
  setEnabled,
} from "./services/user-scripts.service";
import type {
  GmRpcPayload,
  UserScriptRecord,
  UserScriptRunLogEntry,
} from "./types/user-scripts.types";
import { isUserScriptUrl } from "./utils/capture.utils";

export function setupBackground(): void {
  void syncUserScriptsApi().catch(() => {});

  browser.tabs.onRemoved.addListener(forgetTab);

  onMessage<null, UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST, () => list());

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(
    USER_SCRIPTS_ACTIONS.SAVE,
    async (p) => {
      if (!p?.record) throw new Error("Missing record");
      const rec = await save(p.record);
      void reinjectAll();
      return rec;
    },
  );

  onMessage<{ id: string }, boolean>(USER_SCRIPTS_ACTIONS.DELETE, async (p) => {
    const ok = await remove(p?.id ?? "");
    if (ok) void reinjectAll();
    return ok;
  });

  onMessage<{ id: string }, UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.DUPLICATE, async (p) =>
    duplicate(p?.id ?? ""),
  );

  onMessage<{ id: string; index: number }, UserScriptRecord[]>(
    USER_SCRIPTS_ACTIONS.MOVE,
    async (p) => move(p?.id ?? "", p?.index ?? 0),
  );

  onMessage<{ id: string; enabled: boolean }, UserScriptRecord[]>(
    USER_SCRIPTS_ACTIONS.TOGGLE,
    async (p) => {
      const all = await setEnabled(p?.id ?? "", p?.enabled ?? false);
      void reinjectAll();
      return all;
    },
  );

  onMessage<null, string>(USER_SCRIPTS_ACTIONS.EXPORT, async () =>
    JSON.stringify(await list(), null, 2),
  );

  onMessage<{ url: string }, void>(USER_SCRIPTS_ACTIONS.CAPTURE_URL, async (p) => {
    const url = p?.url?.trim();
    if (!url) return;
    const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    if (active?.id == null) return;
    await sendToTab(active.id, APP_ACTIONS.OPEN_LAUNCHER, {
      feature: "user-scripts",
      installUrl: url,
    });
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
      return runScriptsInTab(tabId, "manual", undefined, p?.scriptId);
    },
  );

  if (browser.downloads?.onCreated) {
    browser.downloads.onCreated.addListener(async (item) => {
      const url = item.finalUrl || item.url || "";
      const filename = item.filename || "";
      if (isUserScriptUrl(url) || filename.endsWith(".user.js")) {
        try {
          await browser.downloads.cancel(item.id);
          await browser.downloads.erase({ id: item.id });
        } catch {
          // Ignore if download already handled
        }
        const [active] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
        if (active?.id != null) {
          await sendToTab(active.id, APP_ACTIONS.OPEN_LAUNCHER, {
            feature: "user-scripts",
            installUrl: url,
          }).catch(() => {});
        }
      }
    });
  }

  onMessage<{ scriptId: string }, UserScriptRunLogEntry[]>(
    USER_SCRIPTS_ACTIONS.RUN_LOG,
    async (p) => getRunLog(p?.scriptId ?? ""),
  );

  onMessage<null, Record<string, string>>(USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN, () =>
    getAllScriptTokens(),
  );

  onMessage<GmRpcPayload, unknown>(USER_SCRIPTS_ACTIONS.GM_RPC, (p, sender) => {
    if (!p || !sender.tab?.id) throw new Error("Invalid GM RPC");
    return handleGmRpc(p, sender.tab.id, sender.tab.url ?? "");
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const id = String(info.menuItemId);
    if (!id.startsWith(MENU_PREFIX)) return;
    const [scriptId, commandId] = id.slice(MENU_PREFIX.length).split(":");
    if (tab?.id == null) return;
    void sendToTab(tab.id, USER_SCRIPTS_ACTIONS.GM_MENU_COMMAND, { scriptId, commandId }).catch(
      () => {},
    );
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const isNavigation = changeInfo.status === "complete" || typeof changeInfo.url === "string";
    if (!isNavigation) return;
    const url = changeInfo.url ?? tab.url ?? "";
    if (!url || isBlockedUrl(url)) return;
    if (changeInfo.url) {
      forgetTab(tabId);
    }
    void runScriptsInTab(tabId, "auto", url).catch(() => {});
  });

  browser.alarms.create("us_auto_update", { periodInMinutes: 360 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "us_auto_update") return;
    void checkAll().catch((err) => console.debug("[UserScripts] update tick:", err));
  });
}
