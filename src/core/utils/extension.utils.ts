/**
 * Core Chrome Extension runtime and browser API helpers.
 */
export class ExtensionUtils {
  /**
   * Check if an error or current environment indicates that the extension
   * context has been invalidated (e.g. extension updated or reloaded in developer mode).
   */
  static isContextInvalidated(err: unknown): boolean {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      return true;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('Extension context invalidated');
  }

  /**
   * Safely query the active tab in the current window.
   */
  static async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return null;
    }
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs.length > 0 && tabs[0].id ? tabs[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Safely copy text to the clipboard across different contexts.
   */
  static async copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Ignore copy error in non-focused window
    }
    return false;
  }

  /**
   * Update or clear the browser action badge.
   */
  static async setBadge(text: string, backgroundColor = '#10b981'): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.action) return;
    try {
      await chrome.action.setBadgeText({ text: text || '' });
      if (text) {
        await chrome.action.setBadgeBackgroundColor({ color: backgroundColor });
      }
    } catch {
      // Ignore badge errors
    }
  }

  /**
   * Clear the browser action badge.
   */
  static async clearBadge(): Promise<void> {
    await this.setBadge('');
  }

  /**
   * Show a native Chrome desktop notification.
   */
  static showNotification(options: {
    title: string;
    message: string;
    iconUrl?: string;
    priority?: number;
  }): void {
    if (typeof chrome === 'undefined' || !chrome.notifications) return;
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: options.iconUrl || chrome.runtime.getURL('assets/icons/icon-48.png'),
        title: options.title,
        message: options.message,
        priority: options.priority ?? 2
      });
    } catch (err) {
      console.warn('[ExtensionUtils] Failed to create notification:', err);
    }
  }
}
