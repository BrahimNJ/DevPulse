export interface TtlCacheOptions {
  readonly ttlMs: number;
  /** The least recently used entry is evicted beyond this size. */
  readonly maxEntries: number;
  /** Injected so that expiry is testable; milliseconds, like `Date.now`. */
  readonly now: () => number;
}

export interface CacheResult<V> {
  readonly value: V;
  /** True when no load ran for this call: the value was stored or already loading. */
  readonly hit: boolean;
}

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

/**
 * An in-memory cache with expiry and a bounded size. Concurrent calls for the same key
 * share one load, so a burst of identical requests reaches the source once instead of
 * once per request (a cache stampede). Failed loads are not cached.
 */
export class TtlCache<V> {
  readonly #options: TtlCacheOptions;
  // A Map iterates in insertion order; re-inserting on use keeps the oldest first.
  readonly #entries = new Map<string, Entry<V>>();
  readonly #loading = new Map<string, Promise<V>>();

  constructor(options: TtlCacheOptions) {
    this.#options = options;
  }

  get size(): number {
    return this.#entries.size;
  }

  async getOrLoad(key: string, load: () => Promise<V>): Promise<CacheResult<V>> {
    const stored = this.#fresh(key);
    if (stored !== undefined) {
      return { value: stored, hit: true };
    }
    const pending = this.#loading.get(key);
    if (pending !== undefined) {
      return { value: await pending, hit: true };
    }

    const loading = load();
    this.#loading.set(key, loading);
    try {
      const value = await loading;
      this.#store(key, value);
      return { value, hit: false };
    } finally {
      this.#loading.delete(key);
    }
  }

  #fresh(key: string): V | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    this.#entries.delete(key);
    if (entry.expiresAt <= this.#options.now()) {
      return undefined;
    }
    this.#entries.set(key, entry);
    return entry.value;
  }

  #store(key: string, value: V): void {
    this.#entries.set(key, { value, expiresAt: this.#options.now() + this.#options.ttlMs });
    for (const oldest of this.#entries.keys()) {
      if (this.#entries.size <= this.#options.maxEntries) {
        break;
      }
      this.#entries.delete(oldest);
    }
  }
}
