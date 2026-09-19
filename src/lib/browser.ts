import { browser } from "wxt/browser";
import { sendMessage } from "@/lib/messaging";

export const APP_ACTIONS = {
  OPEN_LAUNCHER: "app:open_launcher",

  COMMAND: "app:command",
} as const;

export const APP_COMMANDS = {
  TOGGLE_DOCK: "toggle-dock",
  COPY_TEMP_EMAIL: "copy-temp-email",
  EXPORT_CHAT: "export-chat",
} as const;

export async function openBentoLauncher(): Promise<void> {
  if (browser.tabs) {
    const [active] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (active?.id != null) {
      await browser.tabs
        .sendMessage(active.id, { action: APP_ACTIONS.OPEN_LAUNCHER })
        .catch(() => {});
      return;
    }
  }
  await sendMessage(APP_ACTIONS.OPEN_LAUNCHER);
}

export const COPY_MESSAGES = {
  success: "Copied to clipboard",
  failure: "Clipboard blocked — select and copy manually",
  empty: "Nothing to copy",
} as const;

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyWithFeedback(text: string): Promise<string> {
  if (!text) return COPY_MESSAGES.empty;
  return (await copyToClipboard(text)) ? COPY_MESSAGES.success : COPY_MESSAGES.failure;
}

export async function copyAndReport(
  text: string,
  report: (message: string, isError: boolean) => void,
  successLabel?: string,
): Promise<void> {
  const message = await copyWithFeedback(text);
  const copied = message === COPY_MESSAGES.success;
  report(copied ? (successLabel ?? message) : message, !copied);
}

export async function setBadge(text: string, color = "#10b981"): Promise<void> {
  if (!browser.action) return;
  try {
    await browser.action.setBadgeText({ text: text || "" });
    if (text) await browser.action.setBadgeBackgroundColor({ color });
  } catch {
    // Badge tidak tersedia di sebagian konteks (mis. saat action tidak ada).
    // Kosmetik saja — jangan sampai menggagalkan alur pemanggilnya.
  }
}

const NOTIFICATION_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export function showNotification(options: {
  title: string;
  message: string;
  iconUrl?: string;
}): void {
  if (!browser.notifications) return;
  browser.notifications
    .create({
      type: "basic",
      iconUrl: options.iconUrl || NOTIFICATION_ICON,
      title: options.title,
      message: options.message,
    })
    .catch(() => {});
}

export function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

export function isContextInvalidated(err: unknown): boolean {
  if (!browser.runtime?.id) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Extension context invalidated");
}

export function escapeHtml(text: string | number | null | undefined): string {
  if (text == null || text === "") return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatRelativeTime(date: string | number | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}
