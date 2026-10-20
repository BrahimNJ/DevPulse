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
  const body = (await response.json()) as BranchReportResponse | ApiErrorResponse;

  if ('error' in body) {
    throw new Error(body.error);
  }
  if (!response.ok) {
    throw new Error(`Request failed with status ${String(response.status)}.`);
  }
  return body;
}
