/**
 * Domain-specific utilities for the TempMail feature module.
 * Encapsulates OTP extraction, email input heuristic detection, and countdown formatting.
 */
export class TempMailUtils {
  /**
   * Determine if an input element represents an email field targeted for TempMail autofill.
   */
  static isEmailField(element: Element | null): boolean {
    if (!element || element.tagName !== 'INPUT') return false;
    // SAFETY: verified tag is INPUT
    const input = element as HTMLInputElement;
    const type = (input.type || '').toLowerCase();

    if (type === 'email') return true;
    if (type !== 'text' && type !== '') return false;

    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

    return Boolean(
      autocomplete === 'email' ||
      name.includes('email') ||
      id.includes('email') ||
      placeholder.includes('email') ||
      ariaLabel.includes('email')
    );
  }

  /**
   * Extract a 4-8 digit verification / OTP code from incoming email subject and body content.
   */
  static extractOtpCode(text: string | null | undefined): string | null {
    if (!text) return null;

    // Look for explicit code/otp labels first
    const match = text.match(/(?:code|otp|verification|token|pin|verify|confirm)\s*(?:is|:|-)?\s*([0-9]{4,8})\b/i);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: search for first 4-8 standalone digit block
    const standalone = text.match(/\b\d{4,8}\b/);
    return standalone ? standalone[0] : null;
  }

  /**
   * Format remaining active seconds for a temporary email address into MM:SS format.
   */
  static formatCountdown(seconds: number): string {
    if (seconds <= 0) return 'Expired';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
