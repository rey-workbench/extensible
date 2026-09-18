import type { ProviderErrorKind, RetryNotice } from "../types/temp-mail.types";

const RATE_LIMIT_CODES = new Set([1011, 1012, 1013, 1014, 1015]);

const BLOCKED_CODES = new Set([1010, 1020]);

const COOLDOWN_LADDER: Record<ProviderErrorKind, readonly number[]> = {
  "rate-limit": [60_000, 300_000, 900_000, 1_800_000, 3_600_000],
  blocked: [600_000, 1_800_000, 3_600_000],
  server: [15_000, 30_000, 60_000],
  timeout: [5_000, 15_000, 30_000],
  offline: [10_000, 30_000, 60_000],
  "bad-response": [10_000, 30_000],

  "not-found": [0],
  unknown: [15_000, 60_000],
};

const MAX_COOLDOWN_MS = 3_600_000;

export interface ProviderFailure {
  kind: ProviderErrorKind;
  status: number;

  message: string;

  retryAfterMs: number;

  code?: number;
  rayId?: string;
}

export class TempMailApiError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status: number;
  readonly retryAfterMs: number;
  readonly rayId?: string;

  readonly body?: string;

  constructor(failure: ProviderFailure, body?: string) {
    super(failure.message);
    this.name = "TempMailApiError";
    this.kind = failure.kind;
    this.status = failure.status;
    this.retryAfterMs = failure.retryAfterMs;
    this.rayId = failure.rayId;
    this.body = body;
  }
}

export function sanitizeProviderText(raw: string, limit = 160): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function isHtmlResponse(body: string): boolean {
  return /^\s*(<!doctype|<html|<head)/i.test(body) || /<\/html>\s*$/i.test(body);
}

export function readCloudflare(body: string): {
  code?: number;
  rayId?: string;
  reason?: string;
} {
  if (!body) return {};
  const codeMatch =
    body.match(/errorCode:\s*(\d{4})/) ??
    body.match(/Error<\/span>\s*<span>\s*(\d{4})/) ??
    body.match(/cf-error-code[^>]*>\s*(\d{4})/);
  const rayMatch = body.match(/Ray ID:\s*(?:<strong[^>]*>)?\s*([a-z0-9]{8,})/i);
  const reasonMatch = body.match(/<h2[^>]*>\s*([^<]+?)\s*<\/h2>/i);
  const code = codeMatch ? Number(codeMatch[1]) : undefined;
  return {
    code: Number.isFinite(code) ? code : undefined,
    rayId: rayMatch?.[1],
    reason: reasonMatch ? sanitizeProviderText(reasonMatch[1]) : undefined,
  };
}

export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return 0;
  return Math.max(0, date - now);
}

export function describeProviderFailure(input: {
  status: number;
  body?: string;
  retryAfter?: string | null;
}): ProviderFailure {
  const { status, body = "", retryAfter = null } = input;
  const cloudflare = readCloudflare(body);
  const retryAfterMs = parseRetryAfter(retryAfter);
  const looksRateLimited = /rate.{0,3}limit/i.test(cloudflare.reason ?? body);

  const base = { status, retryAfterMs, code: cloudflare.code, rayId: cloudflare.rayId };

  if (status === 404) {
    return { ...base, kind: "not-found", message: "That resource is no longer on the provider." };
  }
  if (
    status === 429 ||
    (cloudflare.code != null && RATE_LIMIT_CODES.has(cloudflare.code)) ||
    looksRateLimited
  ) {
    return {
      ...base,
      kind: "rate-limit",
      message: "Temp mail provider is rate-limiting this network.",
    };
  }
  if (
    status === 403 ||
    status === 451 ||
    (cloudflare.code != null && BLOCKED_CODES.has(cloudflare.code))
  ) {
    return {
      ...base,
      kind: "blocked",
      message: cloudflare.code
        ? `Temp mail provider blocked this network (Cloudflare ${cloudflare.code}).`
        : "Temp mail provider blocked this network.",
    };
  }
  if (status >= 500) {
    return {
      ...base,
      kind: "server",
      message: `Temp mail provider is having trouble (HTTP ${status}).`,
    };
  }
  if (isHtmlResponse(body)) {
    return {
      ...base,
      kind: "bad-response",
      message: "Temp mail provider returned an unreadable response.",
    };
  }
  return {
    ...base,
    kind: "unknown",
    message: `Temp mail provider rejected the request (HTTP ${status}).`,
  };
}

export function describeNetworkFailure(err: unknown): ProviderFailure {
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return {
      kind: "timeout",
      status: 0,
      message: "Temp mail provider did not respond in time.",
      retryAfterMs: 0,
    };
  }
  return {
    kind: "offline",
    status: 0,
    message: "Could not reach the temp mail provider.",
    retryAfterMs: 0,
  };
}

export function cooldownFor(kind: ProviderErrorKind, attempts: number, retryAfterMs = 0): number {
  if (retryAfterMs > 0) return Math.min(retryAfterMs, MAX_COOLDOWN_MS);
  const ladder = COOLDOWN_LADDER[kind];
  const index = Math.min(Math.max(attempts, 1) - 1, ladder.length - 1);
  return ladder[index];
}

export function retryNoticeFrom(
  failure: ProviderFailure,
  previous: RetryNotice | null,
  now = Date.now(),
): RetryNotice | null {
  const attempts = previous && previous.kind === failure.kind ? previous.attempts + 1 : 1;
  const waitMs = cooldownFor(failure.kind, attempts, failure.retryAfterMs);
  if (waitMs <= 0) return null;
  return { until: now + waitMs, kind: failure.kind, attempts, message: failure.message };
}

export function isCoolingDown(notice: RetryNotice | null | undefined, now = Date.now()): boolean {
  return !!notice && notice.until > now;
}

export function formatCooldown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export function retryNoticeText(notice: RetryNotice, now = Date.now()): string {
  const left = notice.until - now;
  if (left <= 0) return notice.message;
  return `${notice.message} Retry in ${formatCooldown(left)}.`;
}
