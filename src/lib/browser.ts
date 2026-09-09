import { browser } from "wxt/browser";

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function setBadge(text: string, color = "#10b981"): Promise<void> {
  if (!browser.action) return;
  try {
    await browser.action.setBadgeText({ text: text || "" });
    if (text) await browser.action.setBadgeBackgroundColor({ color });
  } catch {
    // badge unsupported (e.g. Firefox mobile)
  }
}

export function showNotification(options: {
  title: string;
  message: string;
  iconUrl?: string;
}): void {
  if (!browser.notifications) return;
  const iconUrl =
    options.iconUrl ||
    (typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("/icon/128.png")
      : "");
  browser.notifications.create({
    type: "basic",
    iconUrl,
    title: options.title,
    message: options.message,
  });
}

/**
 * Sets a value through the element's native setter so frameworks (React/Vue)
 * pick it up, then fires input/change events. Works for inputs and textareas.
 */
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

/** Sets an email input's value so frameworks pick it up, then fires input events. */
export function setInputValue(input: HTMLInputElement, value: string): void {
  setNativeValue(input, value);
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
