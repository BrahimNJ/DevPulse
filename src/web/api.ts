import type { ApiErrorResponse, BranchReportResponse, QuotaResponse } from '../server/contract.ts';

export type { BranchReportResponse, QuotaResponse };
export type BranchRow = BranchReportResponse['branches'][number];

/** A failed API call; `status` lets the interface explain a quota refusal. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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
    throw new ApiError(message, response.status);
  }
  return body as T;
}
