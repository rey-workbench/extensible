/**
 * Core time and date formatting utilities.
 */
export class TimeUtils {
  /**
   * Format a past timestamp into human-readable relative string.
   */
  static formatRelativeTime(dateString: string | number | Date | null | undefined): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = Date.now();
    const diffSeconds = Math.floor((now - date.getTime()) / 1000);

    if (diffSeconds < 10) return "just now";
    if (diffSeconds < 60) return `${diffSeconds}s ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }

  /**
   * Promisified delay / sleep helper.
   */
  static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
