/**
 * Daily allowance of analyses per visitor (ADR 0008). Each visitor may analyse a few
 * distinct repositories per rolling window; analysing one of them again is free.
 */

/** What a store keeps for one visitor. */
export interface QuotaRecord {
  /** Lower-case `owner/name` of the repositories analysed in the current window. */
  readonly repositories: readonly string[];
  readonly windowStart: Date;
}

/** A versioned record: the version detects concurrent writers. */
export interface StoredRecord {
  readonly record: QuotaRecord;
  readonly version: string;
}

/**
 * Persistence of the records. `put` succeeds only if the record still has
 * `expectedVersion` (null: it must not exist yet), so two instances cannot both
 * grant the last slot.
 */
export interface QuotaStore {
  get(visitor: string): Promise<StoredRecord | null>;
  put(
    visitor: string,
    record: QuotaRecord,
    expectedVersion: string | null,
    expireAt: Date,
  ): Promise<boolean>;
}

export interface QuotaStatus {
  readonly limit: number;
  readonly remaining: number;
  /** When the current window ends; null while the visitor has used nothing. */
  readonly resetsAt: Date | null;
}

export interface Reservation {
  readonly allowed: boolean;
  /** True only when this call used a new slot, so only then may it be given back. */
  readonly charged: boolean;
  readonly status: QuotaStatus;
}

export interface VisitorQuotaOptions {
  readonly store: QuotaStore;
  readonly limit: number;
  readonly windowMs: number;
  /** Injected so that windows are testable. */
  readonly now: () => Date;
}

/** Writes lost to a concurrent writer are retried this many times. */
const MAX_ATTEMPTS = 4;

export class QuotaConflictError extends Error {
  constructor() {
    super('The visitor allowance kept changing concurrently.');
    this.name = 'QuotaConflictError';
  }
}

export class VisitorQuota {
  readonly #options: VisitorQuotaOptions;

  constructor(options: VisitorQuotaOptions) {
    this.#options = options;
  }

  async status(visitor: string): Promise<QuotaStatus> {
    const current = this.#current(await this.#options.store.get(visitor));
    return this.#statusOf(current.record);
  }

  /** Counts `repository` for the visitor, unless the allowance is used up. */
  async reserve(visitor: string, repository: string): Promise<Reservation> {
    const key = repository.toLowerCase();
    return this.#update(visitor, (record) => {
      if (record.repositories.includes(key)) {
        return { allowed: true, charged: false, next: null };
      }
      if (record.repositories.length >= this.#options.limit) {
        return { allowed: false, charged: false, next: null };
      }
      return {
        allowed: true,
        charged: true,
        next: { ...record, repositories: [...record.repositories, key] },
      };
    });
  }

  /** Gives a slot back, for a repository that turned out not to exist. */
  async release(visitor: string, repository: string): Promise<void> {
    const key = repository.toLowerCase();
    await this.#update(visitor, (record) => ({
      allowed: true,
      charged: false,
      next: record.repositories.includes(key)
        ? { ...record, repositories: record.repositories.filter((name) => name !== key) }
        : null,
    }));
  }

  async #update(
    visitor: string,
    decide: (record: QuotaRecord) => {
      allowed: boolean;
      charged: boolean;
      next: QuotaRecord | null;
    },
  ): Promise<Reservation> {
    const { store } = this.#options;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const current = this.#current(await store.get(visitor));
      const { allowed, charged, next } = decide(current.record);
      if (next === null) {
        return { allowed, charged, status: this.#statusOf(current.record) };
      }
      const expireAt = new Date(next.windowStart.getTime() + this.#options.windowMs);
      if (await store.put(visitor, next, current.version, expireAt)) {
        return { allowed, charged, status: this.#statusOf(next) };
      }
    }
    throw new QuotaConflictError();
  }

  /** The stored record, or a fresh window when there is none or it has ended. */
  #current(stored: StoredRecord | null): { record: QuotaRecord; version: string | null } {
    const now = this.#options.now();
    if (stored === null) {
      return { record: { repositories: [], windowStart: now }, version: null };
    }
    const ended = stored.record.windowStart.getTime() + this.#options.windowMs <= now.getTime();
    return {
      record: ended ? { repositories: [], windowStart: now } : stored.record,
      version: stored.version,
    };
  }

  #statusOf(record: QuotaRecord): QuotaStatus {
    const { limit, windowMs } = this.#options;
    return {
      limit,
      remaining: Math.max(0, limit - record.repositories.length),
      resetsAt:
        record.repositories.length === 0 ? null : new Date(record.windowStart.getTime() + windowMs),
    };
  }
}

/** A store for tests and local runs; it forgets everything on restart. */
export class MemoryQuotaStore implements QuotaStore {
  readonly #records = new Map<string, StoredRecord>();
  #nextVersion = 1;

  get(visitor: string): Promise<StoredRecord | null> {
    return Promise.resolve(this.#records.get(visitor) ?? null);
  }

  put(visitor: string, record: QuotaRecord, expectedVersion: string | null): Promise<boolean> {
    const current = this.#records.get(visitor)?.version ?? null;
    if (current !== expectedVersion) {
      return Promise.resolve(false);
    }
    this.#records.set(visitor, { record, version: String(this.#nextVersion++) });
    return Promise.resolve(true);
  }
}
