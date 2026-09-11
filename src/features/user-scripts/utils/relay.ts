import { browser } from "wxt/browser";
import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
import type { GmRpcPayload } from "../types/user-scripts.types";

const CALL = "us:gm:call";
const RESP = "us:gm:resp";
const CHANGED = "us:gm:changed";

interface GmCallMessage {
  __us: typeof CALL;
  id: number;
  fn: string;
  args: unknown[];
  scriptId: string;
  token?: string;
}

export function setupGmRelay(): void {
  const activeTokens = new Map<string, string>();

  browser.runtime
    .sendMessage({ action: USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN })
    .then((res) => {
      const tokens = res as Record<string, string> | undefined;
      if (tokens && typeof tokens === "object") {
        for (const [scriptId, token] of Object.entries(tokens)) {
          activeTokens.set(token, scriptId);
        }
      }
    })
    .catch(() => {});

  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const d = ev.data as Partial<GmCallMessage> | null;
    if (!d || d.__us !== CALL) return;

    if (!d.token || activeTokens.get(d.token) !== d.scriptId) {
      console.warn("[UserScripts] Rejected unauthorized GM RPC invocation:", d.fn);
      return;
    }

    void handleCall(d as GmCallMessage);
  });

  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = raw as { action?: string; payload?: unknown } | null;
    if (!msg) return undefined;

    if (msg.action === USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN) {
      const p = msg.payload as { scriptId: string; token: string } | undefined;
      if (p?.token && p?.scriptId) {
        activeTokens.set(p.token, p.scriptId);
      }
      return undefined;
    }

    if (msg.action === USER_SCRIPTS_ACTIONS.GM_VALUE_CHANGED && msg.payload) {
      const p = msg.payload as GmValueChangedShape;
      window.postMessage({ __us: CHANGED, ...p }, "*");
      return undefined;
    }
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
  const payload: GmRpcPayload = {
    scriptId: msg.scriptId,
    fn: msg.fn,
    args: msg.args,
    token: msg.token,
  };
  try {
    const res = await browser.runtime.sendMessage({
      action: USER_SCRIPTS_ACTIONS.GM_RPC,
      payload,
    });
    const env = res as { success: boolean; data?: unknown; error?: string };
    if (!env || env.success === false) throw new Error(env?.error || "GM RPC rejected");
    window.postMessage({ __us: RESP, id: msg.id, token: msg.token, ok: true, data: env.data }, "*");
  } catch (err) {
    window.postMessage(
      {
        __us: RESP,
        id: msg.id,
        token: msg.token,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      "*",
    );
  }
}
