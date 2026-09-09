/** Generic cross-cutting helpers shared by features (ids, delays, settings handling). */

/** Builds a unique id like `<prefix>_<ts>_<rand>` (used for chats, exports, history…). */
export function createUniqueId(prefix: string, suffixLength = 6): string {
  const rand = Math.random()
    .toString(36)
    .slice(2, 2 + suffixLength);
  return `${prefix}_${Date.now()}_${rand}`;
}

/** Promise-based sleep. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Guards against corrupted storage values: falls back to `defaults` when the
 * saved value isn't a plain object (storage may hold stale/garbage data).
 */
export function readSettings<T extends object>(saved: unknown, defaults: T): T {
  return saved && typeof saved === "object" ? (saved as T) : defaults;
}

/** Shallow-merges a partial settings payload over the current settings. */
export function mergeSettings<T extends object>(current: T, partial: Partial<T>): T {
  return { ...current, ...partial };
}
