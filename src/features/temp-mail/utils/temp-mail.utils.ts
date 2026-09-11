/**
 * Domain-specific utilities for the TempMail feature module.
 * Encapsulates OTP extraction, email input heuristic detection, and countdown formatting.
 */
export class TempMailUtils {
  /**
   * Determine if an input element represents an email field targeted for TempMail autofill.
   */
  static isEmailField(el: Element): boolean {
    if (!(el instanceof HTMLInputElement)) return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "email") return true;
    if (type === "hidden" || el.disabled || el.readOnly) return false;
    const hint = `${el.name} ${el.id} ${el.placeholder} ${el.autocomplete}`.toLowerCase();
    return /e-?mail/.test(hint);
  }

  /**
   * Extract a 4-8 digit verification / OTP code from incoming email subject and body content.
   * Uses strict contextual matching and strips CSS, scripts, tags, and URLs to prevent false positives.
   */
  static extractOtpCode(text: string | null | undefined): string | null {
    if (!text) return null;

    // 1. Strip CSS blocks, script tags, URLs, and HTML tags to avoid matching hex colors (#555555) or hashes
    const cleanText = text
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/https?:\/\/[^\s"'<>]+/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z0-9#]+;/gi, " ");

    // 2. High-confidence contextual patterns for OTPs
    const patterns = [
      // "verification code is 123456", "security code: 123456", "code is: 123456"
      /(?:verification|security|login|one-time|confirmation|access)?\s*code\s*(?:is|:|-)?\s*([0-9]{4,8})\b/i,
      // "123456 is your verification code", "123456 is your code"
      /\b([0-9]{4,8})\s+is\s+your\s+(?:[a-z]+\s+)?code\b/i,
      // "otp: 123456", "otp is 123456", "passcode: 123456", "pin: 1234"
      /\b(?:otp|passcode|pin)\s*(?:is|:|-)?\s*([0-9]{4,8})\b/i,
      // "use code 123456", "enter code 123456"
      /\b(?:enter|use|input)\s+(?:the\s+)?code\s+([0-9]{4,8})\b/i,
      // "[123456] is your ..."
      /\[([0-9]{4,8})\]\s*(?:is\s+your|verification)/i,
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Format remaining active seconds for a temporary email address into MM:SS format.
   */
  static formatCountdown(seconds: number): string {
    if (seconds <= 0) return "Expired";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}

export const extractOtpCode = TempMailUtils.extractOtpCode;
export const isEmailField = TempMailUtils.isEmailField;
export const formatCountdown = TempMailUtils.formatCountdown;
