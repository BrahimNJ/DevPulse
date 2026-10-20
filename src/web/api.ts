import type { ApiErrorResponse, BranchReportResponse } from '../server/contract.ts';

export type { BranchReportResponse };
export type BranchRow = BranchReportResponse['branches'][number];

/** Calls the local DevPulse API; the GitHub token never reaches the browser. */
export async function fetchBranchReport(
  repository: string,
  staleDays: number,
  signal: AbortSignal,
): Promise<BranchReportResponse> {
  const query = new URLSearchParams({ repo: repository, staleDays: String(staleDays) });
  const response = await fetch(`/api/branches?${query.toString()}`, { signal });
  const body = await readJson(response);

  if (body !== null && 'error' in body) {
    throw new Error(body.error);
  }
  if (!response.ok || body === null) {
    throw new Error(`Request failed with status ${String(response.status)}.`);
  }
  return body;
}

/** Null when the body is not JSON, such as an HTML error page from a proxy. */
async function readJson(
  response: Response,
): Promise<BranchReportResponse | ApiErrorResponse | null> {
  try {
    return (await response.json()) as BranchReportResponse | ApiErrorResponse;
  } catch {
    return null;
  }
}
