/**
 * ISOLATED-world relay: one per tab. Bridges MAIN-world GM RPC postMessages to
 * the background service worker via chrome.runtime messaging (ARC-02), and
 * delivers GM value-change events back into the page.
 */
import { browser } from "wxt/browser";
import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
import type { GmHttpResponse, GmRpcPayload } from "../types/user-scripts.types";

const CALL = "us:gm:call";
const RESP = "us:gm:resp";
const CHANGED = "us:gm:changed";

interface GmCallMessage {
  __us: typeof CALL;
  id: number;
  fn: string;
  args: unknown[];
  scriptId: string;
}

export function setupGmRelay(): void {
  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const d = ev.data as Partial<GmCallMessage> | null;
    if (!d || d.__us !== CALL) return;
    void handleCall(d as GmCallMessage);
  });

  // Background pushes value-change events here; forward into the page world.
  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = raw as { action?: string; payload?: GmValueChangedShape } | null;
    if (!msg || msg.action !== USER_SCRIPTS_ACTIONS.GM_VALUE_CHANGED || !msg.payload)
      return undefined;
    window.postMessage({ __us: CHANGED, ...msg.payload }, "*");
    return undefined;
  });
}

interface GmValueChangedShape {
  scriptId: string;
  key: string;
  listenerId: number;
  oldValue: unknown;
  newValue: unknown;
  remote: boolean;
}

async function handleCall(msg: GmCallMessage): Promise<void> {
  const payload: GmRpcPayload = { scriptId: msg.scriptId, fn: msg.fn, args: msg.args };
  try {
    const res = await browser.runtime.sendMessage({
      action: USER_SCRIPTS_ACTIONS.GM_RPC,
      payload,
    });
    const env = res as { success: boolean; data?: unknown; error?: string };
    if (!env || env.success === false) throw new Error(env?.error || "GM RPC rejected");
    window.postMessage({ __us: RESP, id: msg.id, ok: true, data: env.data }, "*");
  } catch (err) {
    window.postMessage(
      {
        __us: RESP,
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      "*"
    );
  }
}

export type { GmHttpResponse };
