import { browser } from "wxt/browser";
import { onMessage, sendToTab } from "@/lib/messaging";
import { isBlockedUrl, USER_SCRIPTS_ACTIONS } from "./constants/user-scripts.constants";
import { handleGmRpc, MENU_PREFIX } from "./services/gm-rpc.service";
import {
  forgetTab,
  onTabLoading,
  reinjectAll,
  runScriptsInTab,
  syncUserScriptsApi,
} from "./services/injection.engine";
import { checkAll } from "./services/update.service";
import {
  duplicate,
  get,
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
import { recordFromCode } from "./utils/record-factory.utils";

export function setupBackground(): void {
  void syncUserScriptsApi().catch(() => {});

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading") onTabLoading(tabId);
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    forgetTab(tabId);
  });

  onMessage<null, UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST, async () => list());

  onMessage<{ id: string }, UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.GET, async (p) =>
    get(p?.id ?? ""),
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(USER_SCRIPTS_ACTIONS.SAVE, (p) => {
    if (!p?.record) throw new Error("Missing record");
    return save(p.record);
  });

  onMessage<{ id: string }, boolean>(USER_SCRIPTS_ACTIONS.DELETE, async (p) => {
    const ok = await remove(p?.id ?? "");
    if (ok) await reinjectAll();
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
      await reinjectAll();
      return all;
    },
  );

  onMessage<{ record: UserScriptRecord }, UserScriptRecord>(
    USER_SCRIPTS_ACTIONS.IMPORT_FILE,
    (p) => {
      if (!p?.record) throw new Error("Missing record");
      return save(p.record);
    },
  );

  onMessage<null, string>(USER_SCRIPTS_ACTIONS.EXPORT, async () =>
    JSON.stringify(await list(), null, 2),
  );

  onMessage<{ url: string }, UserScriptRecord>(USER_SCRIPTS_ACTIONS.INSTALL_FROM_URL, async (p) => {
    const url = p?.url?.trim();
    if (!url) throw new Error("Missing URL");
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const record = recordFromCode(await res.text());
    await save(record);
    await reinjectAll();
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
      return runScriptsInTab(tabId, "manual", undefined, p?.scriptId);
    },
  );

  onMessage<{ scriptId: string }, void>(USER_SCRIPTS_ACTIONS.OPEN_EDITOR, async (p) => {
    const script = await get(p?.scriptId ?? "");
    if (!script) throw new Error("Script not found");
    const url = browser.runtime.getURL("/popup.html#/user-scripts-editor");
    await browser.tabs.create({ url: `${url}?id=${encodeURIComponent(script.id)}` });
  });

  onMessage<{ scriptId: string }, UserScriptRunLogEntry[]>(
    USER_SCRIPTS_ACTIONS.RUN_LOG,
    async (p) => getRunLog(p?.scriptId ?? ""),
  );

  onMessage<null, Record<string, string>>(USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN, async () =>
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
    if (changeInfo.status !== "complete") return;
    const url = changeInfo.url ?? tab.url ?? "";
    if (!url || isBlockedUrl(url)) return;
    void runScriptsInTab(tabId, "auto", url).catch(() => {});
  });

  browser.alarms.create("us_auto_update", { periodInMinutes: 360 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "us_auto_update") return;
    void checkAll().catch((err) => console.debug("[UserScripts] update tick:", err));
  });
}
