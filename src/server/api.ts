import { DEFAULT_STALE_DAYS, parseRepository, parseStaleDays } from '../branches/input.ts';
import { buildBranchReport, type BranchReport } from '../branches/report.ts';
import { fetchRepositoryBranches } from '../github/branches.ts';
import { GitHubError, type GitHubClient } from '../github/client.ts';
import type { ApiErrorResponse } from './contract.ts';

export interface ApiDependencies {
  readonly client: GitHubClient;
  readonly now: () => Date;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: BranchReport | ApiErrorResponse;
}

/** Handles `GET /api/branches?repo=<owner>/<repo>[&staleDays=<n>]`. */
export async function handleBranchesRequest(
  query: URLSearchParams,
  dependencies: ApiDependencies,
): Promise<ApiResponse> {
  const repository = parseRepository(query.get('repo') ?? '');
  if (repository === null) {
    return failure(400, 'Expected a repository as <owner>/<repo>.');
  }
  const rawStaleDays = query.get('staleDays');
  const staleDays = rawStaleDays === null ? DEFAULT_STALE_DAYS : parseStaleDays(rawStaleDays);
  if (staleDays === null) {
    return failure(400, 'staleDays must be a positive whole number.');
  }

  try {
    const branches = await fetchRepositoryBranches(
      dependencies.client,
      repository.owner,
      repository.name,
    );
    return {
      status: 200,
      body: buildBranchReport(branches, { now: dependencies.now(), staleDays }),
    };
  } catch (error) {
    if (error instanceof GitHubError) {
      // A missing repository is the caller's problem; anything else is GitHub's.
      return failure(error.status === 404 ? 404 : 502, error.message);
    }
    throw error;
  }
}

function failure(status: number, error: string): ApiResponse {
  return { status, body: { error } };
}
