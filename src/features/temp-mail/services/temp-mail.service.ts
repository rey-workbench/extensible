import { storage } from "wxt/utils/storage";
import {
  DEFAULT_TEMPMAIL_SETTINGS,
  TEMPMAIL_CONFIG,
  TEMPMAIL_STORAGE_KEYS,
} from "../constants/temp-mail.constants";
import type {
  EmailMessage,
  InboxState,
  RetryNotice,
  TempEmail,
  TempMailCurrentState,
  TempMailSettings,
} from "../types/temp-mail.types";
import {
  describeNetworkFailure,
  describeProviderFailure,
  isCoolingDown,
  type ProviderFailure,
  retryNoticeFrom,
  retryNoticeText,
  sanitizeProviderText,
  TempMailApiError,
} from "../utils/provider-error.utils";

const emailItem = storage.defineItem<TempEmail | null>(TEMPMAIL_STORAGE_KEYS.STATE, {
  defaultValue: null,
});
export const inboxItem = storage.defineItem<EmailMessage[]>(TEMPMAIL_STORAGE_KEYS.INBOX_CACHE, {
  defaultValue: [],
});
export const tempMailSettings = storage.defineItem<TempMailSettings>(
  TEMPMAIL_STORAGE_KEYS.SETTINGS,
  { defaultValue: DEFAULT_TEMPMAIL_SETTINGS },
);

const retryItem = storage.defineItem<RetryNotice | null>(TEMPMAIL_STORAGE_KEYS.RETRY, {
  defaultValue: null,
});

const MAX_CACHED_EMAILS = 30;

export function getRetryNotice(): Promise<RetryNotice | null> {
  return retryItem.getValue();
}

export async function getTempMailSettings(): Promise<TempMailSettings> {
  const stored = await tempMailSettings.getValue();
  return { ...DEFAULT_TEMPMAIL_SETTINGS, ...(stored ?? {}) };
}

export async function updateTempMailSettings(
  partial: Partial<TempMailSettings>,
): Promise<TempMailSettings> {
  const updated = { ...(await getTempMailSettings()), ...partial };
  await tempMailSettings.setValue(updated);
  return updated;
}

async function activeRetryNotice(): Promise<RetryNotice | null> {
  const notice = await retryItem.getValue();
  return isCoolingDown(notice) ? notice : null;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, TEMPMAIL_CONFIG.ERROR_BODY_LIMIT);
  } catch {
    return "";
  }
}

async function failWith(failure: ProviderFailure, body?: string): Promise<TempMailApiError> {
  const previous = await retryItem.getValue();
  const notice = retryNoticeFrom(failure, previous);
  await retryItem.setValue(notice);
  console.debug(
    `[TempMail] ${failure.kind}${failure.status ? ` HTTP ${failure.status}` : ""}` +
      `${failure.rayId ? ` ray ${failure.rayId}` : ""}` +
      `${notice ? ` — next attempt in ${Math.round((notice.until - Date.now()) / 1000)}s` : ""}`,
  );
  return new TempMailApiError(
    { ...failure, message: notice ? retryNoticeText(notice) : failure.message },
    body,
  );
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const cooling = await activeRetryNotice();
  if (cooling) {
    throw new TempMailApiError({
      kind: cooling.kind,
      status: 0,
      message: retryNoticeText(cooling),
      retryAfterMs: cooling.until - Date.now(),
    });
  }

  let res: Response;
  try {
    res = await fetch(`${TEMPMAIL_CONFIG.API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw await failWith(describeNetworkFailure(err));
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw await failWith(
      describeProviderFailure({
        status: res.status,
        body,
        retryAfter: res.headers.get("retry-after"),
      }),
      body,
    );
  }

  if (await retryItem.getValue()) await retryItem.setValue(null);

  try {
    return (await res.json()) as T;
  } catch {
    throw await failWith({
      kind: "bad-response",
      status: res.status,
      message: "Temp mail provider returned an unreadable response.",
      retryAfterMs: 0,
    });
  }
}

export async function generateEmail(durationMinutes?: number): Promise<TempEmail> {
  const duration = durationMinutes ?? TEMPMAIL_CONFIG.DEFAULT_DURATION;
  const data = await call<{ success: boolean; email?: TempEmail; error?: string }>(
    "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration }),
    },
  );
  if (!data.success || !data.email) {
    const detail = sanitizeProviderText(data.error ?? "");
    throw new TempMailApiError({
      kind: "unknown",
      status: 200,
      message: detail || "Temp mail provider did not return an address.",
      retryAfterMs: 0,
    });
  }
  await emailItem.setValue(data.email);
  await inboxItem.setValue([]);
  return data.email;
}

function isExpired(email: TempEmail | null): boolean {
  return !email || Date.now() >= new Date(email.expiresAt).getTime();
}

async function getValidEmail(): Promise<TempEmail | null> {
  const email = await emailItem.getValue();
  if (isExpired(email)) {
    if (email !== null) {
      await emailItem.setValue(null);
      await inboxItem.setValue([]);
    }
    return null;
  }
  return email;
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
    retry: await activeRetryNotice(),
  };
}

export async function fetchInbox(): Promise<EmailMessage[]> {
  const email = await getValidEmail();
  if (!email) return [];

  const addr = encodeURIComponent(email.address);
  let data: { emails?: EmailMessage[] };
  try {
    data = await call<{ emails?: EmailMessage[] }>(`/api/emails/${addr}`);
  } catch (err) {
    if (err instanceof TempMailApiError && err.kind === "not-found") {
      await inboxItem.setValue([]);
      return [];
    }
    throw err;
  }

  const existing = await inboxItem.getValue();
  const readIds = new Set(existing.filter((e) => e.is_read).map((e) => e.id));
  const merged = (data.emails ?? []).map((item) => ({
    ...item,
    is_read: readIds.has(item.id) || !!item.is_read,
  }));
  const capped = merged.slice(0, MAX_CACHED_EMAILS);
  await inboxItem.setValue(capped);
  return capped;
}

export async function getInboxState(): Promise<InboxState> {
  return {
    emails: await inboxItem.getValue(),
    remainingSeconds: await getRemainingSeconds(),
    retry: await activeRetryNotice(),
  };
}

export async function deleteMessage(messageId: string | number): Promise<boolean> {
  const email = await getValidEmail();
  if (!email) return false;

  const addr = encodeURIComponent(email.address);
  const cooling = await activeRetryNotice();
  if (!cooling) {
    try {
      const res = await fetch(
        `${TEMPMAIL_CONFIG.API_BASE}/api/emails/${addr}/${encodeURIComponent(String(messageId))}`,
        {
          method: "DELETE",
          signal: AbortSignal.timeout(TEMPMAIL_CONFIG.REQUEST_TIMEOUT_MS),
        },
      );
      if (!res.ok) console.warn(`[TempMail] server delete failed: HTTP ${res.status}`);
    } catch (err) {
      console.warn("[TempMail] server delete failed:", describeNetworkFailure(err).message);
    }
  }

  const emails = (await inboxItem.getValue()).filter((e) => String(e.id) !== String(messageId));
  await inboxItem.setValue(emails);
  return true;
}
