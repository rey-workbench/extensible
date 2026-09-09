/**
 * Injectable StorageService providing namespaced access to chrome.storage.local
 * with in-memory fallback for unit tests and SSR, plus reactive onChanged watching.
 */
export class StorageService {
  private readonly namespace: string;
  private readonly _memory = new Map<string, unknown>();
  private readonly _watchers = new Map<
    string,
    Set<(newValue: unknown, oldValue: unknown) => void>
  >();

  constructor(namespace: string = "aio") {
    this.namespace = namespace;
  }

  private _getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    const fullKey = this._getKey(key);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return new Promise<T | null>((resolve) => {
        chrome.storage.local.get([fullKey], (result) => {
          if (chrome.runtime.lastError) {
            console.warn("[StorageService] Get error:", chrome.runtime.lastError);
            resolve(defaultValue);
          } else {
            // SAFETY: typed result from chrome.storage
            const val = result[fullKey] !== undefined ? (result[fullKey] as T) : defaultValue;
            resolve(val);
          }
        });
      });
    }
    return this._memory.has(fullKey) ? (this._memory.get(fullKey) as T) : defaultValue;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = this._getKey(key);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [fullKey]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    const oldValue = this._memory.get(fullKey) ?? null;
    this._memory.set(fullKey, value);
    this._notifyWatchers(fullKey, value, oldValue);
  }

  async remove(key: string): Promise<void> {
    const fullKey = this._getKey(key);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove([fullKey], () => resolve());
      });
    }
    const oldValue = this._memory.get(fullKey) ?? null;
    this._memory.delete(fullKey);
    this._notifyWatchers(fullKey, null, oldValue);
  }

  /**
   * Watch reactive changes to a specific storage key.
   * Returns an unsubscribe teardown function.
   */
  watch<T>(key: string, callback: (newValue: T | null, oldValue: T | null) => void): () => void {
    const fullKey = this._getKey(key);

    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === "local" && fullKey in changes) {
          const change = changes[fullKey];
          callback(
            change.newValue !== undefined ? (change.newValue as T) : null,
            change.oldValue !== undefined ? (change.oldValue as T) : null
          );
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => {
        chrome.storage.onChanged.removeListener(listener);
      };
    }

    if (!this._watchers.has(fullKey)) {
      this._watchers.set(fullKey, new Set());
    }
    const set = this._watchers.get(fullKey)!;
    // SAFETY: watcher callbacks are registered via watch<T>, value shape is enforced there
    const wrapped = callback as unknown as (newValue: unknown, oldValue: unknown) => void;
    set.add(wrapped);

    return () => {
      set.delete(wrapped);
      if (set.size === 0) {
        this._watchers.delete(fullKey);
      }
    };
  }

  private _notifyWatchers(fullKey: string, newValue: unknown, oldValue: unknown): void {
    const watchers = this._watchers.get(fullKey);
    if (watchers) {
      for (const cb of watchers) {
        cb(newValue, oldValue);
      }
    }
  }

  onModuleDestroy(): void {
    this._watchers.clear();
  }
}
