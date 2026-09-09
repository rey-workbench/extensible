import { type Browser, browser } from "wxt/browser";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

type Handler = (payload: unknown, sender: Browser.runtime.MessageSender) => unknown;

const handlers = new Map<string, Handler>();

/** Start listening once per context; safe to call from multiple features. */
function startMessageListener(): void {
  if (listeners > 0) return;
  listeners++;
  browser.runtime.onMessage.addListener((raw: unknown, sender) => {
    const msg = raw as { action?: unknown; payload?: unknown } | null;
    if (!msg || typeof msg.action !== "string") return undefined;

    const handler = handlers.get(msg.action);
    if (!handler) return undefined;

    return Promise.resolve()
      .then(() => handler(msg.payload, sender))
      .then(
        (data): ApiResponse => ({ success: true, data }),
        (err: unknown): ApiResponse => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      );
  });
}

let listeners = 0;

export function onMessage<TReq = unknown, TRes = unknown>(
  action: string,
  handler: (payload: TReq, sender: Browser.runtime.MessageSender) => TRes | Promise<TRes>
): void {
  handlers.set(action, handler as unknown as Handler);
  startMessageListener();
}

/** Unwraps a message response, throwing on failure or missing handler. */
function unwrap<TRes>(res: ApiResponse<TRes> | undefined, errorLabel: string): TRes {
  if (!res || res.success === false) throw new Error(res?.error || errorLabel);
  return res.data as TRes;
}

export function sendMessage<TRes = unknown>(action: string, payload?: unknown): Promise<TRes> {
  return browser.runtime
    .sendMessage({ action, payload })
    .then((res) => unwrap(res, "Request failed"));
}

export function sendToTab<TRes = unknown>(
  tabId: number,
  action: string,
  payload?: unknown
): Promise<TRes> {
  return browser.tabs
    .sendMessage(tabId, { action, payload })
    .then((res) => unwrap(res, "Tab request failed"));
}
