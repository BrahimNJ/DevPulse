import type { AccessTokenProvider } from './google-auth.ts';
import type { QuotaRecord, QuotaStore, StoredRecord } from './quota.ts';

export interface FirestoreQuotaStoreOptions {
  readonly project: string;
  readonly accessToken: AccessTokenProvider;
  /** Injected so that tests never reach the network. */
  readonly fetch: typeof fetch;
  readonly baseUrl?: string;
}

interface FirestoreDocument {
  readonly fields?: {
    readonly repositories?: { readonly arrayValue?: { readonly values?: readonly Value[] } };
    readonly windowStart?: { readonly timestampValue?: string };
  };
  readonly updateTime: string;
}

interface Value {
  readonly stringValue?: string;
}

const COLLECTION = 'visitors';
const CALL_TIMEOUT_MS = 3000;

/**
 * Visitor records in Cloud Firestore through its REST API (ADR 0008). The document's
 * `updateTime` is the version: a write carries it as a precondition, so a concurrent
 * write makes it fail instead of silently overwriting. `expireAt` feeds the TTL policy
 * that deletes finished windows.
 */
export class FirestoreQuotaStore implements QuotaStore {
  readonly #options: FirestoreQuotaStoreOptions;
  readonly #documents: string;

  constructor(options: FirestoreQuotaStoreOptions) {
    this.#options = options;
    const base = options.baseUrl ?? 'https://firestore.googleapis.com/v1';
    this.#documents = `${base}/projects/${encodeURIComponent(options.project)}/databases/(default)/documents/${COLLECTION}`;
  }

  async get(visitor: string): Promise<StoredRecord | null> {
    const response = await this.#call(this.#url(visitor), { method: 'GET' });
    if (response.status === 404) {
      return null;
    }
    await assertOk(response);
    const document = (await response.json()) as FirestoreDocument;
    const repositories = (document.fields?.repositories?.arrayValue?.values ?? []).flatMap(
      (value) => (value.stringValue === undefined ? [] : [value.stringValue]),
    );
    const windowStart = document.fields?.windowStart?.timestampValue;
    if (windowStart === undefined) {
      throw new Error(`Visitor record ${visitor} has no window start.`);
    }
    return {
      record: { repositories, windowStart: new Date(windowStart) },
      version: document.updateTime,
    };
  }

  async put(
    visitor: string,
    record: QuotaRecord,
    expectedVersion: string | null,
    expireAt: Date,
  ): Promise<boolean> {
    const precondition =
      expectedVersion === null
        ? 'currentDocument.exists=false'
        : `currentDocument.updateTime=${encodeURIComponent(expectedVersion)}`;
    const response = await this.#call(`${this.#url(visitor)}?${precondition}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          repositories: {
            arrayValue: { values: record.repositories.map((name) => ({ stringValue: name })) },
          },
          windowStart: { timestampValue: record.windowStart.toISOString() },
          expireAt: { timestampValue: expireAt.toISOString() },
        },
      }),
    });
    // The record expired and was deleted after it was read: retry from scratch.
    if (response.status === 404 && expectedVersion !== null) {
      return false;
    }
    // A failed precondition means another instance wrote first.
    if (response.status === 400 || response.status === 409) {
      const status = await errorStatus(response);
      if (status === 'FAILED_PRECONDITION' || status === 'ALREADY_EXISTS') {
        return false;
      }
      throw new Error(`Firestore rejected the write: ${status}.`);
    }
    await assertOk(response);
    return true;
  }

  #url(visitor: string): string {
    return `${this.#documents}/${encodeURIComponent(visitor)}`;
  }

  async #call(url: string, init: RequestInit): Promise<Response> {
    const token = await this.#options.accessToken();
    return this.#options.fetch(url, {
      ...init,
      // A stuck call must not hold the visitor's request.
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
  }
}

async function errorStatus(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { status?: string } };
    return body.error?.status ?? `HTTP ${String(response.status)}`;
  } catch {
    return `HTTP ${String(response.status)}`;
  }
}

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(`Firestore answered ${await errorStatus(response)}.`);
  }
}
