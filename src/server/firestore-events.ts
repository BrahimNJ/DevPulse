import type {
  AnalysisEvent,
  Device,
  EventStore,
  Language,
  Outcome,
  ReportKind,
} from './analytics.ts';
import type { AccessTokenProvider } from './google-auth.ts';

export interface FirestoreEventStoreOptions {
  readonly project: string;
  readonly accessToken: AccessTokenProvider;
  /** Injected so that tests never reach the network. */
  readonly fetch: typeof fetch;
  readonly retentionMs: number;
  readonly baseUrl?: string;
}

type Value =
  | { readonly stringValue: string }
  | { readonly integerValue: string }
  | { readonly booleanValue: boolean }
  | { readonly timestampValue: string }
  | { readonly nullValue: null };

type Fields = Readonly<Record<string, Value | undefined>>;

const COLLECTION = 'events';
const CALL_TIMEOUT_MS = 3000;

/**
 * Analysis events in Cloud Firestore through its REST API (ADR 0011). Each event is a
 * document with a generated id; `expireAt` feeds the TTL policy that deletes it.
 */
export class FirestoreEventStore implements EventStore {
  readonly #options: FirestoreEventStoreOptions;
  readonly #database: string;

  constructor(options: FirestoreEventStoreOptions) {
    this.#options = options;
    const base = options.baseUrl ?? 'https://firestore.googleapis.com/v1';
    this.#database = `${base}/projects/${encodeURIComponent(options.project)}/databases/(default)/documents`;
  }

  async add(event: AnalysisEvent): Promise<void> {
    const expireAt = new Date(event.at.getTime() + this.#options.retentionMs);
    const response = await this.#call(`${this.#database}/${COLLECTION}`, {
      fields: { ...toFields(event), expireAt: { timestampValue: expireAt.toISOString() } },
    });
    await assertOk(response);
  }

  async recent(since: Date, limit: number): Promise<AnalysisEvent[]> {
    const response = await this.#call(`${this.#database}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: COLLECTION }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'at' },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { timestampValue: since.toISOString() },
          },
        },
        orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }],
        limit,
      },
    });
    await assertOk(response);
    const results = (await response.json()) as readonly { document?: { fields?: Fields } }[];
    return results.flatMap((result) => {
      const event =
        result.document?.fields === undefined ? null : fromFields(result.document.fields);
      return event === null ? [] : [event];
    });
  }

  async #call(url: string, body: unknown): Promise<Response> {
    const token = await this.#options.accessToken();
    return this.#options.fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      // A stuck call must not hold the visitor's request.
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
  }
}

function toFields(event: AnalysisEvent): Record<string, Value> {
  return {
    at: { timestampValue: event.at.toISOString() },
    report: { stringValue: event.report },
    repository: event.repository === null ? { nullValue: null } : { stringValue: event.repository },
    visitor: { stringValue: event.visitor },
    owner: { booleanValue: event.owner },
    status: { integerValue: String(event.status) },
    outcome: { stringValue: event.outcome },
    durationMs: { integerValue: String(Math.round(event.durationMs)) },
    cacheHit: event.cacheHit === null ? { nullValue: null } : { booleanValue: event.cacheHit },
    device: { stringValue: event.device },
    language: { stringValue: event.language },
  };
}

/** An event, or null for a document missing what every event has: skipped, not miscounted. */
function fromFields(fields: Fields): AnalysisEvent | null {
  const at = text(fields['at'], 'timestampValue');
  const outcome = text(fields['outcome'], 'stringValue');
  const visitor = text(fields['visitor'], 'stringValue');
  if (at === null || outcome === null || visitor === null) {
    return null;
  }
  return {
    at: new Date(at),
    report: (text(fields['report'], 'stringValue') ?? 'branches') as ReportKind,
    repository: text(fields['repository'], 'stringValue'),
    visitor,
    owner: flag(fields['owner']) ?? false,
    status: Number(text(fields['status'], 'integerValue') ?? 0),
    outcome: outcome as Outcome,
    durationMs: Number(text(fields['durationMs'], 'integerValue') ?? 0),
    cacheHit: flag(fields['cacheHit']),
    device: (text(fields['device'], 'stringValue') ?? 'desktop') as Device,
    language: (text(fields['language'], 'stringValue') ?? 'other') as Language,
  };
}

function text(
  value: Value | undefined,
  kind: 'stringValue' | 'integerValue' | 'timestampValue',
): string | null {
  return value !== undefined && kind in value
    ? ((value as Record<string, string>)[kind] ?? null)
    : null;
}

function flag(value: Value | undefined): boolean | null {
  return value !== undefined && 'booleanValue' in value ? value.booleanValue : null;
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    let status = `HTTP ${String(response.status)}`;
    try {
      const body = (await response.json()) as { error?: { status?: string } };
      status = body.error?.status ?? status;
    } catch {
      // The status code is enough.
    }
    throw new Error(`Firestore answered ${status}.`);
  }
}
