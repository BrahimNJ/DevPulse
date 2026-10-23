import type {
  ApiErrorResponse,
  BranchReportResponse,
  DeliveryReportResponse,
  QuotaResponse,
} from '../server/contract.ts';

export type { BranchReportResponse, DeliveryReportResponse, QuotaResponse };
export type BranchRow = BranchReportResponse['branches'][number];

/**
 * A failed API call. The status and the allowance headers let the interface explain
 * the failure in the visitor's language rather than show the server's English text.
 */
export class ApiError extends Error {
  readonly status: number;
  /** The daily allowance is used up, as opposed to the per-minute rate limit. */
  readonly quotaExceeded: boolean;
  readonly resetsAt: string | null;

  constructor(message: string, status: number, headers?: Headers) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.quotaExceeded = headers?.get('x-quota-remaining') === '0';
    this.resetsAt = headers?.get('x-quota-reset') ?? null;
  }
}

export interface ReportResult {
  readonly report: BranchReportResponse;
  /** The allowance after this report, read from the response headers; null if none. */
  readonly quota: Pick<QuotaResponse, 'limit' | 'remaining' | 'resetsAt'> | null;
}

/** Calls the DevPulse API; the GitHub token never reaches the browser. */
export async function fetchBranchReport(
  repository: string,
  staleDays: number,
  signal: AbortSignal,
): Promise<ReportResult> {
  const query = new URLSearchParams({ repo: repository, staleDays: String(staleDays) });
  const response = await fetch(`/api/branches?${query.toString()}`, { signal });
  const body = await readJson<BranchReportResponse>(response);
  // The allowance travels with every report, so no second request is needed.
  return { report: body, quota: quotaFromHeaders(response.headers) };
}

export interface DeliveryResult {
  readonly report: DeliveryReportResponse;
  readonly quota: ReportResult['quota'];
}

/** The delivery report; it shares the allowance of the branch report of the same repository. */
export async function fetchDeliveryReport(
  repository: string,
  signal: AbortSignal,
): Promise<DeliveryResult> {
  const query = new URLSearchParams({ repo: repository });
  const response = await fetch(`/api/delivery?${query.toString()}`, { signal });
  const body = await readJson<DeliveryReportResponse>(response);
  return { report: body, quota: quotaFromHeaders(response.headers) };
}

export async function fetchQuota(signal?: AbortSignal): Promise<QuotaResponse> {
  const response = await fetch('/api/quota', signal === undefined ? {} : { signal });
  return readJson<QuotaResponse>(response);
}

export async function signInAsOwner(key: string): Promise<void> {
  const response = await fetch('/api/owner', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  await readJson<{ owner: boolean }>(response);
}

export async function signOut(): Promise<void> {
  await readJson<{ owner: boolean }>(await fetch('/api/owner', { method: 'DELETE' }));
}

function quotaFromHeaders(headers: Headers): ReportResult['quota'] {
  const limit = headers.get('x-quota-limit');
  const remaining = headers.get('x-quota-remaining');
  if (limit === null || remaining === null) {
    return null;
  }
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    resetsAt: headers.get('x-quota-reset'),
  };
}

/** The body as T, or an ApiError with the server's message. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // An HTML error page from a proxy is reported by its status below.
  }
  if (!response.ok || body === null) {
    const message =
      body !== null && typeof body === 'object' && 'error' in body
        ? (body as ApiErrorResponse).error
        : `Request failed with status ${String(response.status)}.`;
    throw new ApiError(message, response.status, response.headers);
  }
  return body as T;
}
