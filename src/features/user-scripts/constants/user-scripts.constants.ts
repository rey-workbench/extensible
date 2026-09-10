import type { UserScriptMeta } from "../types/user-scripts.types";

/** Message channel names (all behind constants — atomic rename later). */
export const USER_SCRIPTS_ACTIONS = {
  LIST: "user_scripts:list",
  GET: "user_scripts:get",
  SAVE: "user_scripts:save",
  DELETE: "user_scripts:delete",
  DUPLICATE: "user_scripts:dup",
  MOVE: "user_scripts:move",
  TOGGLE: "user_scripts:toggle",
  IMPORT_FILE: "user_scripts:import",
  EXPORT: "user_scripts:export",
  /** Ask background to fetch + parse a .user.js from a URL (install flow). */
  INSTALL_FROM_URL: "user_scripts:install_url",
  /** Ask background to run all matching scripts in a tab now. */
  RUN_IN_TAB: "user_scripts:run_in_tab",
  /** Pop the script into a dedicated editor tab. */
  OPEN_EDITOR: "user_scripts:open_editor",

  // GM RPC bridge (ARC-02): content <-> background
  GM_RPC: "user_scripts:gm_rpc",
  GM_VALUE_CHANGED: "user_scripts:gm_value_changed",
  GM_MENU_COMMAND: "user_scripts:gm_menu_command",
  GM_MENU_REGISTERED: "user_scripts:gm_menu_registered",
} as const;

/** Storage areas (chrome.storage.local via WXT storage). */
export const USER_SCRIPTS_STORAGE_KEYS = {
  SCRIPTS: "local:user_scripts:scripts",
  RUN_LOGS: "local:user_scripts:run_logs",
  GM_VALUES: "local:user_scripts:gm_values",
} as const;

/**
 * SEC-04: GM APIs a script may receive, keyed by the @grant literal.
 * Anything not listed here cannot be granted.
 */
const GM_GRANT_REGISTRY = {
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

/** All API globals a script gets for a given list of @grant literals (SEC-04). */
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

/** URL schemes that must never be script targets (SEC-05). */
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
