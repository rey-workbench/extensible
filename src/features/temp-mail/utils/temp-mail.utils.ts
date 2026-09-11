export function isEmailField(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  const type = (el.getAttribute("type") || "text").toLowerCase();
  if (type === "email") return true;
  if (type === "hidden" || el.disabled || el.readOnly) return false;
  const hint = `${el.name} ${el.id} ${el.placeholder} ${el.autocomplete}`.toLowerCase();
  return /e-?mail/.test(hint);
}

export function extractOtpCode(text: string | null | undefined): string | null {
  if (!text) return null;

  const cleanText = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/https?:\/\/[^\s"'<>]+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ");

  const patterns = [
    /(?:verification|security|login|one-time|confirmation|access)?\s*code\s*(?:is|:|-)?\s*([0-9]{4,8})\b/i,
    /\b([0-9]{4,8})\s+is\s+your\s+(?:[a-z]+\s+)?code\b/i,
    /\b(?:otp|passcode|pin)\s*(?:is|:|-)?\s*([0-9]{4,8})\b/i,
    /\b(?:enter|use|input)\s+(?:the\s+)?code\s+([0-9]{4,8})\b/i,
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

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Expired";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function sanitizeEmailHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const bannedTags = [
      "script",
      "object",
      "embed",
      "iframe",
      "base",
      "form",
      "meta",
      "link",
      "applet",
    ];
    for (const tag of bannedTags) {
      doc.querySelectorAll(tag).forEach((el) => {
        el.remove();
      });
    }

    const allElements = doc.querySelectorAll("*");
    for (const el of allElements) {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        } else if (
          (name === "href" || name === "src" || name === "action" || name === "formaction") &&
          (val.startsWith("javascript:") ||
            val.startsWith("vbscript:") ||
            val.startsWith("data:text/html"))
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }

    return doc.body.innerHTML;
  } catch {
    return rawHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<iframe[^>]*\/?>/gi, "")
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[^>]*\/?>/gi, "")
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
      .replace(
        /(href|src|action|formaction)\s*=\s*(['"])\s*(javascript|vbscript|data:text\/html):.*?\2/gi,
        "",
      );
  }
}

export const TempMailUtils = {
  isEmailField,
  extractOtpCode,
  formatCountdown,
  sanitizeEmailHtml,
};
