import type { UserScriptMeta } from "../types/user-scripts.types";

export const USER_SCRIPTS_ACTIONS = {
  LIST: "user_scripts:list",
  SAVE: "user_scripts:save",
  DELETE: "user_scripts:delete",
  DUPLICATE: "user_scripts:dup",
  MOVE: "user_scripts:move",
  TOGGLE: "user_scripts:toggle",
  EXPORT: "user_scripts:export",
  CAPTURE_URL: "user_scripts:capture_url",
  RUN_IN_TAB: "user_scripts:run_in_tab",

  GM_RPC: "user_scripts:gm_rpc",
  GM_VALUE_CHANGED: "user_scripts:gm_value_changed",
  GM_MENU_COMMAND: "user_scripts:gm_menu_command",
  REGISTER_SESSION_TOKEN: "user_scripts:register_session_token",
  RUN_LOG: "user_scripts:run_log",
} as const;

export const USER_SCRIPTS_STORAGE_KEYS = {
  SCRIPTS: "local:user_scripts:scripts",
  RUN_LOGS: "local:user_scripts:run_logs",
  GM_VALUES: "local:user_scripts:gm_values",
} as const;

export const GM_GRANT_REGISTRY = {
  none: [],
  unsafeWindow: ["unsafeWindow"],
  GM_getValue: ["GM.getValue", "GM_getValue"],
  GM_setValue: ["GM.setValue", "GM_setValue"],
  GM_deleteValue: ["GM.deleteValue", "GM_deleteValue"],
  GM_listValues: ["GM.listValues", "GM_listValues"],
  GM_addValueChangeListener: ["GM.addValueChangeListener", "GM_addValueChangeListener"],
  GM_removeValueChangeListener: ["GM.removeValueChangeListener", "GM_removeValueChangeListener"],
  GM_xmlhttpRequest: ["GM.xmlHttpRequest", "GM_xmlhttpRequest"],
  GM_download: ["GM.download", "GM_download"],
  GM_addStyle: ["GM.addStyle", "GM_addStyle"],
  GM_getResourceURL: ["GM.getResourceUrl", "GM_getResourceURL"],
  GM_setClipboard: ["GM.setClipboard", "GM_setClipboard"],
  GM_notification: ["GM.notification", "GM_notification"],
  GM_registerMenuCommand: ["GM.registerMenuCommand", "GM_registerMenuCommand"],
} as const satisfies Record<string, readonly string[]>;

export function resolveGrants(grants: string[]): string[] {
  const out = new Set<string>();
  if (grants.includes("none")) return [];
  for (const grant of grants) {
    const apis = (GM_GRANT_REGISTRY as Record<string, readonly string[]>)[grant];
    if (apis) for (const api of apis) out.add(api);
  }
  return [...out];
}

export const USER_SCRIPTS_DEFAULT_META: Omit<UserScriptMeta, "name"> = {
  namespace: "",
  version: "1.0.0",
  description: "",
  matches: ["*://*/*"],
  excludes: [],
  runAt: "document-idle",
  grants: ["none"],
  requires: [],
  resources: {},
  injectInto: "content",
  connects: [],
  updateURL: "",
  downloadURL: "",
  icon: "",
};

const BLOCKED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "edge://",
  "about:",
  "moz-extension://",
  "view-source:",
  "devtools://",
  "https://chrome.google.com/webstore",
  "https://chromewebstore.google.com",
] as const;

export function isBlockedUrl(url: string): boolean {
  const u = url.toLowerCase();
  return BLOCKED_URL_PREFIXES.some((p) => u.startsWith(p));
}
