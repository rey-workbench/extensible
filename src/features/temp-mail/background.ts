import { browser } from "wxt/browser";
import { setBadge, showNotification } from "@/lib/browser";
import { onMessage, sendToTab } from "@/lib/messaging";
import { mergeSettings } from "@/lib/utils";
import { TEMPMAIL_ACTIONS, TEMPMAIL_CONFIG } from "./constants/temp-mail.constants";
import {
  deleteMessage,
  fetchInbox,
  generateEmail,
  getCurrentState,
  getInboxState,
  getRetryNotice,
  hasValidEmail,
  inboxItem,
  tempMailSettings,
} from "./services/temp-mail.service";
import type {
  InboxState,
  TempEmail,
  TempMailCurrentState,
  TempMailSettings,
} from "./types/temp-mail.types";

const ALARM_NAME = "tempmail_poll";

let consecutiveErrors = 0;
let nextAllowedPollTime = 0;
let lastFetchTime = 0;

async function pollInbox(): Promise<void> {
  lastFetchTime = Date.now();
  try {
    await fetchInbox();
    consecutiveErrors = 0;
    nextAllowedPollTime = 0;
  } catch (err) {
    consecutiveErrors++;
    const backoffMs = Math.min(300_000, 2 ** Math.min(consecutiveErrors, 5) * 10_000);
    const providerUntil = (await getRetryNotice())?.until ?? 0;
    nextAllowedPollTime = Math.max(Date.now() + backoffMs, providerUntil);
    throw err;
  } finally {
    await updateBadge();
  }
}

async function pollInboxQuietly(): Promise<void> {
  try {
    await pollInbox();
  } catch (err) {
    console.debug(
      `[TempMail] poll failed (${consecutiveErrors} consecutive): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function executeInboxPoll(): Promise<void> {
  if (Date.now() < nextAllowedPollTime) return;
  if (Date.now() - lastFetchTime < TEMPMAIL_CONFIG.MIN_FETCH_INTERVAL_MS) return;
  if (!(await hasValidEmail())) return;
  await pollInboxQuietly();
}

async function updateBadge(): Promise<void> {
  if (!(await hasValidEmail())) return setBadge("");
  const unread = (await getCurrentState(false)).unreadCount;
  if (unread > 0) await setBadge(String(unread));
  else await setBadge("");
}

export function setupBackground(): void {
  onMessage<{ autoGenerate?: boolean } | null, TempMailCurrentState>(
    TEMPMAIL_ACTIONS.GET_CURRENT,
    async (payload) => {
      let state: TempMailCurrentState;
      try {
        state = await getCurrentState(payload?.autoGenerate ?? false);
      } catch (err) {
        console.debug(
          `[TempMail] state read failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        state = await getCurrentState(false);
      }
      if (state.hasValidEmail) void executeInboxPoll();
      return state;
    },
  );

  onMessage<{ duration?: number } | null, TempEmail>(
    TEMPMAIL_ACTIONS.GENERATE_NEW,
    async (payload) => {
      const email = await generateEmail(payload?.duration);
      consecutiveErrors = 0;
      nextAllowedPollTime = 0;
      lastFetchTime = Date.now();
      await updateBadge();
      return email;
    },
  );

  onMessage<{ force?: boolean } | null, InboxState>(TEMPMAIL_ACTIONS.GET_INBOX, async (payload) => {
    if (payload?.force === true) {
      if (await hasValidEmail()) {
        try {
          await pollInbox();
        } catch (err) {
          console.debug(
            `[TempMail] manual refresh failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } else {
      await executeInboxPoll();
    }
    return getInboxState();
  });

  onMessage<{ messageId: string | number }, boolean>(
    TEMPMAIL_ACTIONS.DELETE_MESSAGE,
    async (payload) => {
      if (!payload?.messageId) throw new Error("Missing messageId");
      const ok = await deleteMessage(payload.messageId);
      await updateBadge();
      return ok;
    },
  );

  onMessage<Partial<TempMailSettings>, TempMailSettings>(
    TEMPMAIL_ACTIONS.UPDATE_SETTINGS,
    async (payload) => {
      const current = await tempMailSettings.getValue();
      const updated = mergeSettings(current, payload);
      await tempMailSettings.setValue(updated);
      return updated;
    },
  );

  onMessage<null, boolean>(TEMPMAIL_ACTIONS.AUTOFILL_ACTIVE_TAB, async () => fillActiveTab(null));

  browser.alarms.create(ALARM_NAME, { periodInMinutes: TEMPMAIL_CONFIG.POLL_INTERVAL_SEC / 60 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    void executeInboxPoll();
  });

  void inboxItem.watch((newEmails, oldEmails) => {
    const prev = oldEmails ?? [];
    if (newEmails.length <= prev.length) return;
    const fresh = newEmails.find((e) => !prev.some((p) => String(p.id) === String(e.id)));
    if (!fresh) return;
    showNotification({
      title: fresh.subject ? `New mail: ${fresh.subject}` : "New mail received",
      message: `From ${fresh.from_address || "unknown sender"}`,
    });
    void updateBadge();
  });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "tempmail_root",
      title: "Temp Mail",
      contexts: ["editable", "page"],
    });
    browser.contextMenus.create({
      id: "tempmail_fill",
      parentId: "tempmail_root",
      title: "Fill with Temp Mail",
      contexts: ["editable"],
    });
    browser.contextMenus.create({
      id: "tempmail_copy",
      parentId: "tempmail_root",
      title: "Copy Active Temp Mail",
      contexts: ["all"],
    });
    browser.contextMenus.create({
      id: "tempmail_new",
      parentId: "tempmail_root",
      title: "Generate Fresh Email",
      contexts: ["all"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    if (info.menuItemId === "tempmail_fill") {
      await fillActiveTab(tab.id);
    } else if (info.menuItemId === "tempmail_copy") {
      const addr = await resolveAddress();
      if (!addr) return;
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text: string) => navigator.clipboard.writeText(text),
        args: [addr],
      });
    } else if (info.menuItemId === "tempmail_new") {
      try {
        await generateEmail();
        await updateBadge();
      } catch (err) {
        console.debug(
          `[TempMail] menu generate failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
}

async function resolveAddress(): Promise<string | null> {
  try {
    const state = await getCurrentState(true);
    return state.email?.address ?? null;
  } catch (err) {
    console.debug(
      `[TempMail] no address available: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function fillActiveTab(tabId: number | null): Promise<boolean> {
  const address = await resolveAddress();
  if (!address) return false;
  try {
    const targetTabId =
      tabId ??
      (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id ??
      (await browser.tabs.query({ active: true }))[0]?.id;
    if (targetTabId == null) return false;
    await sendToTab(targetTabId, TEMPMAIL_ACTIONS.AUTOFILL_EMAIL, { email: address });
    return true;
  } catch {
    return false;
  }
}
