export interface RateLimiterOptions {
  /** Sustained rate per client; a client may also burst up to this many requests. */
  readonly limitPerMinute: number;
  /** The least recently seen client is forgotten beyond this many, bounding memory. */
  readonly maxClients: number;
  /** Injected so that refills are testable; milliseconds, like `Date.now`. */
  readonly now: () => number;
}

export type RateDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

interface Bucket {
  readonly tokens: number;
  readonly updatedAt: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * A token bucket per client: each request spends a token, and tokens refill
 * continuously up to the limit. Forgetting a client resets its bucket to full, which
 * can only make the limiter more lenient, never block a legitimate client.
 */
export class RateLimiter {
  readonly #options: RateLimiterOptions;
  readonly #buckets = new Map<string, Bucket>();

  constructor(options: RateLimiterOptions) {
    this.#options = options;
  }

  take(client: string): RateDecision {
    const { limitPerMinute, maxClients } = this.#options;
    const now = this.#options.now();
    const refillPerMs = limitPerMinute / MS_PER_MINUTE;
    const bucket = this.#buckets.get(client);
    const tokens =
      bucket === undefined
        ? limitPerMinute
        : Math.min(limitPerMinute, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);

    // Re-inserting keeps the Map ordered from least to most recently seen.
    this.#buckets.delete(client);
    const allowed = tokens >= 1;
    this.#buckets.set(client, { tokens: allowed ? tokens - 1 : tokens, updatedAt: now });
    for (const oldest of this.#buckets.keys()) {
      if (this.#buckets.size <= maxClients) {
        break;
      }
      this.#buckets.delete(oldest);
    }

    return allowed
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerMs / 1000) };
  }
}
