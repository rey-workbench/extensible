/**
 * Injectable EventBusService providing in-memory Pub/Sub event dispatcher.
 */
type Listener = (data: never) => void;

export class EventBusService {
  private readonly _listeners = new Map<string, Set<Listener>>();

  on<T = unknown>(event: string, callback: (data: T) => void): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    const set = this._listeners.get(event)!;
    // SAFETY: emit() only ever passes the T the subscriber registered with
    set.add(callback as unknown as Listener);
    return () => this.off(event, callback);
  }

  off<T = unknown>(event: string, callback: (data: T) => void): void {
    const subs = this._listeners.get(event);
    if (subs) {
      subs.delete(callback as unknown as Listener);
      if (subs.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  emit<T = unknown>(event: string, data: T): void {
    const subs = this._listeners.get(event);
    if (subs) {
      for (const callback of subs) {
        try {
          (callback as (data: T) => void)(data);
        } catch (err) {
          console.error(`[EventBusService] Error in listener for ${event}:`, err);
        }
      }
    }
  }

  onModuleDestroy(): void {
    this._listeners.clear();
  }
}
