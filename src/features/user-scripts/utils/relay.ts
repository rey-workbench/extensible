import { onMessage, sendMessage } from "@/lib/messaging";
import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
import type { GmRpcPayload } from "../types/user-scripts.types";

const CALL = "us:gm:call";
const RESP = "us:gm:resp";
const CHANGED = "us:gm:changed";
const MENU = "us:gm:menu";

interface GmCallMessage {
  __us: typeof CALL;
  id: number;
  fn: string;
  args: unknown[];
  scriptId: string;
  token?: string;
}

interface GmValueChangedShape {
  scriptId: string;
  key: string;
  listenerId: number;
  oldValue: unknown;
  newValue: unknown;
  remote: boolean;
}

const activeTokens = new Map<string, string>();

function rememberTokens(tokens: Record<string, string> | undefined): void {
  if (!tokens) return;
  for (const [scriptId, token] of Object.entries(tokens)) activeTokens.set(token, scriptId);
}

async function handleCall(msg: GmCallMessage): Promise<void> {
  const payload: GmRpcPayload = {
    scriptId: msg.scriptId,
    fn: msg.fn,
    args: msg.args,
    token: msg.token,
  };
  try {
    const data = await sendMessage<unknown>(USER_SCRIPTS_ACTIONS.GM_RPC, payload);
    window.postMessage({ __us: RESP, id: msg.id, token: msg.token, ok: true, data }, "*");
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

export function setupGmRelay(): void {
  void sendMessage<Record<string, string>>(USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN)
    .then(rememberTokens)
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

  onMessage<{ scriptId: string; token: string } | null>(
    USER_SCRIPTS_ACTIONS.REGISTER_SESSION_TOKEN,
    (p) => {
      if (p?.token && p.scriptId) activeTokens.set(p.token, p.scriptId);
    },
  );

  onMessage<GmValueChangedShape | null>(USER_SCRIPTS_ACTIONS.GM_VALUE_CHANGED, (p) => {
    if (p) window.postMessage({ __us: CHANGED, ...p }, "*");
  });

  onMessage<{ scriptId: string; commandId: string } | null>(
    USER_SCRIPTS_ACTIONS.GM_MENU_COMMAND,
    (p) => {
      if (p) {
        window.postMessage({ __us: MENU, scriptId: p.scriptId, commandId: p.commandId }, "*");
      }
    },
  );
}
