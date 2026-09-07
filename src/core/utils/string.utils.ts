/**
 * Core string manipulation and sanitization utilities.
 */
export class StringUtils {
  /**
   * Escape HTML special characters for safe inclusion in DOM text and attributes.
   */
  static escapeHtml(text: string | number | null | undefined): string {
    if (text === null || text === undefined || text === '') return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const escapeHtml = StringUtils.escapeHtml;
