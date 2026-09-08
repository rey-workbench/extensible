import type { ApiResponse } from "@/core/types/api.types";
import { ExtensionUtils } from "@/core/utils/extension.utils";

export type MessageHandler<P = any, R = any> = (
  payload: P,
  sender: chrome.runtime.MessageSender
) => Promise<R> | R;

/**
 * Injectable MessageRouterService managing IPC message patterns between
 * Background Worker, Content Scripts, and Popup.
 */
export class MessageRouterService {
  private readonly _handlers = new Map<string, MessageHandler>();
  private _isListening = false;
  private _listenerRef:
    | ((
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
      ) => boolean)
    | null = null;

  subscribe<P = any, R = any>(pattern: string, handler: MessageHandler<P, R>): void {
    this._handlers.set(pattern, handler as MessageHandler);
  }

  unsubscribe(pattern: string): void {
    this._handlers.delete(pattern);
  }

  onModuleInit(): void {
    this.startListening();
  }

  onModuleDestroy(): void {
    this.stopListening();
  }

  startListening(): void {
    if (this._isListening || typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return;
    }

    this._isListening = true;
    this._listenerRef = (message, sender, sendResponse) => {
      if (!message || typeof message.action !== "string") {
        return false;
      }

      // Security check: restrict messages to our extension context only
      if (typeof chrome !== "undefined" && chrome.runtime?.id) {
        if (sender.id && sender.id !== chrome.runtime.id) {
          console.warn(
            `[MessageRouterService] Blocked message from unauthorized sender: ${sender.id}`
          );
          return false;
        }
      }

      const handler = this._handlers.get(message.action);
      if (!handler) {
        return false;
      }

      const safeSend = (res: ApiResponse): void => {
        try {
          sendResponse(res);
        } catch {
          // Channel closed before response arrived (e.g. popup closed)
        }
      };

      try {
        const result = handler(message.payload, sender);
        if (result instanceof Promise) {
          result
            .then((data) => safeSend({ success: true, data } satisfies ApiResponse))
            .catch((error: Error | string) => {
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`[MessageRouterService] Action '${message.action}' error:`, error);
              safeSend({ success: false, error: msg } satisfies ApiResponse);
            });
          return true; // Keep channel open for async response
        } else {
          safeSend({ success: true, data: result } satisfies ApiResponse);
          return false;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[MessageRouterService] Sync error in '${message.action}':`, err);
        safeSend({ success: false, error: msg } satisfies ApiResponse);
        return false;
      }
    };

    chrome.runtime.onMessage.addListener(this._listenerRef);
  }

  stopListening(): void {
    if (
      this._isListening &&
      this._listenerRef &&
      typeof chrome !== "undefined" &&
      chrome.runtime?.onMessage
    ) {
      chrome.runtime.onMessage.removeListener(this._listenerRef);
      this._isListening = false;
      this._listenerRef = null;
    }
  }

  async send<T = unknown>(action: string, payload: unknown = null): Promise<T> {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      throw new Error("Chrome runtime unavailable");
    }

    return new Promise<T>((resolve, reject) => {
      chrome.runtime.sendMessage({ action, payload }, (response: ApiResponse<T>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success === false) {
          reject(new Error(response.error || "Request failed"));
        } else {
          // SAFETY: response data is typed as T
          resolve((response ? response.data : null) as T);
        }
      });
    });
  }

  async sendToTab<T = unknown>(tabId: number, action: string, payload: unknown = null): Promise<T> {
    if (typeof chrome === "undefined" || !chrome.tabs?.sendMessage) {
      throw new Error("Chrome tabs API unavailable");
    }

    return new Promise<T>((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action, payload }, (response: ApiResponse<T>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success === false) {
          reject(new Error(response.error || "Tab request failed"));
        } else {
          // SAFETY: response data is typed as T
          resolve((response ? response.data : null) as T);
        }
      });
    });
  }

  /**
   * Dispatch a message directly to the currently active browser tab.
   * Returns null if no active tab or content script is available.
   */
  async sendToActiveTab<T = any>(action: string, payload: any = null): Promise<T | null> {
    const tab = await ExtensionUtils.getActiveTab();
    if (!tab?.id) return null;
    return this.sendToTab<T>(tab.id, action, payload);
  }
}
