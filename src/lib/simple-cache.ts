type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class SimpleCache<TKey, TValue> {
  private readonly store = new Map<TKey, CacheEntry<TValue>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 50) {}

  get(key: TKey): TValue | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: TKey, value: TValue): TValue {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}
