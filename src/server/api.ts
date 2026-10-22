import { DEFAULT_STALE_DAYS, parseRepository, parseStaleDays } from '../branches/input.ts';
import { buildBranchReport, type BranchReport } from '../branches/report.ts';
import { GitHubError } from '../github/client.ts';
import type { ApiErrorResponse } from './contract.ts';
import { ServiceError, type BranchLoader } from './source.ts';

export interface ApiDependencies {
  readonly loadBranches: BranchLoader;
  readonly now: () => Date;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: BranchReport | ApiErrorResponse;
  readonly headers?: Readonly<Record<string, string>>;
  /** Whether the repository data came from the cache; absent when none was loaded. */
  readonly cacheHit?: boolean;
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
    const { branches, cacheHit } = await dependencies.loadBranches(repository);
    return {
      status: 200,
      body: buildBranchReport(branches, { now: dependencies.now(), staleDays }),
      cacheHit,
    };
  } catch (error) {
    return loadFailure(error);
  }
}

function loadFailure(error: unknown): ApiResponse {
  if (error instanceof ServiceError) {
    const { retryAfterSeconds } = error;
    return retryAfterSeconds === null
      ? failure(error.status, error.message)
      : {
          ...failure(error.status, error.message),
          headers: { 'retry-after': String(retryAfterSeconds) },
        };
  }
  if (error instanceof GitHubError) {
    // A missing repository is the caller's problem; anything else is GitHub's.
    return failure(error.status === 404 ? 404 : 502, error.message);
  }
  throw error;
}

function failure(status: number, error: string): ApiResponse {
  return { status, body: { error } };
}
