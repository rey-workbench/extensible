/**
 * TempMail service — plain functions, state persisted via WXT storage items.
 * Works in any context; API calls only ever run in the background.
 */
import { storage } from "wxt/utils/storage";
import {
  DEFAULT_TEMPMAIL_SETTINGS,
  TEMPMAIL_CONFIG,
  TEMPMAIL_STORAGE_KEYS,
} from "../constants/temp-mail.constants";
import type {
  EmailMessage,
  InboxState,
  TempEmail,
  TempMailCurrentState,
  TempMailSettings,
} from "../types/temp-mail.types";

const emailItem = storage.defineItem<TempEmail | null>(TEMPMAIL_STORAGE_KEYS.STATE, {
  defaultValue: null,
});
export const inboxItem = storage.defineItem<EmailMessage[]>(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, {
  defaultValue: [],
});
export const tempMailSettings = storage.defineItem<TempMailSettings>(
  TEMPMAIL_STORAGE_KEYS.SETTINGS,
  { defaultValue: DEFAULT_TEMPMAIL_SETTINGS }
);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${TEMPMAIL_CONFIG.API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TempMail API error (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

/** Generate a fresh address, replacing any previous one. */
export async function generateEmail(durationMinutes?: number): Promise<TempEmail> {
  const duration = durationMinutes ?? TEMPMAIL_CONFIG.DEFAULT_DURATION;
  const data = await api<{ success: boolean; email?: TempEmail; error?: string }>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duration }),
  });
  if (!data.success || !data.email) throw new Error(data.error || "Failed to generate email");
  await emailItem.setValue(data.email);
  await inboxItem.setValue([]);
  return data.email;
}

function isExpired(email: TempEmail | null): boolean {
  return !email || Date.now() >= new Date(email.expiresAt).getTime();
}

/** Returns the current address when still valid, otherwise null. */
async function getValidEmail(): Promise<TempEmail | null> {
  const email = await emailItem.getValue();
  return isExpired(email) ? null : email;
}

export async function hasValidEmail(): Promise<boolean> {
  return (await getValidEmail()) !== null;
}

async function getRemainingSeconds(): Promise<number> {
  const email = await getValidEmail();
  if (!email) return 0;
  return Math.max(0, Math.floor((new Date(email.expiresAt).getTime() - Date.now()) / 1000));
}

export async function getCurrentState(autoGenerate = false): Promise<TempMailCurrentState> {
  let email = await getValidEmail();
  if (!email && autoGenerate) email = await generateEmail();
  const unread = (await inboxItem.getValue()).filter((e) => !e.is_read).length;
  return {
    email,
    remainingSeconds: await getRemainingSeconds(),
    hasValidEmail: email !== null,
    unreadCount: unread,
  };
}

/** Fetch inbox from the API, merging read-state; 404 means empty inbox. */
export async function fetchInbox(): Promise<EmailMessage[]> {
  const email = await getValidEmail();
  if (!email) return [];

  const addr = encodeURIComponent(email.address);
  const res = await fetch(`${TEMPMAIL_CONFIG.API_BASE}/api/emails/${addr}`, {
    signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    if (res.status === 404) {
      await inboxItem.setValue([]);
      return [];
    }
    throw new Error(`Inbox fetch error: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { emails?: EmailMessage[] };
  const existing = await inboxItem.getValue();
  const readIds = new Set(existing.filter((e) => e.is_read).map((e) => e.id));
  const merged = (data.emails ?? []).map((item) => ({
    ...item,
    is_read: readIds.has(item.id) || !!item.is_read,
  }));
  await inboxItem.setValue(merged);
  return merged;
}

export async function getInboxState(): Promise<InboxState> {
  return {
    emails: await inboxItem.getValue(),
    remainingSeconds: await getRemainingSeconds(),
  };
}

export async function deleteMessage(messageId: string | number): Promise<boolean> {
  const email = await getValidEmail();
  if (!email) return false;

  const addr = encodeURIComponent(email.address);
  try {
    await fetch(
      `${TEMPMAIL_CONFIG.API_BASE}/api/emails/${addr}/${encodeURIComponent(String(messageId))}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS),
      }
    );
  } catch (err) {
    console.warn("[TempMail] server delete failed:", err);
  }
  const emails = (await inboxItem.getValue()).filter((e) => String(e.id) !== String(messageId));
  await inboxItem.setValue(emails);
  return true;
}
