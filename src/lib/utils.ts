export function createUniqueId(prefix: string, suffixLength = 6): string {
  const rand = Math.random()
    .toString(36)
    .slice(2, 2 + suffixLength);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readSettings<T extends object>(saved: unknown, defaults: T): T {
  return saved && typeof saved === "object" ? (saved as T) : defaults;
}

export function mergeSettings<T extends object>(current: T, partial: Partial<T>): T {
  return { ...current, ...partial };
}
