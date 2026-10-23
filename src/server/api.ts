import {
  DEFAULT_STALE_DAYS,
  parseRepository,
  parseStaleDays,
  type RepositoryRef,
} from '../branches/input.ts';
import { buildBranchReport, type BranchReport } from '../branches/report.ts';
import { buildDeliveryReport, type DeliveryReport } from '../delivery/report.ts';
import { GitHubError } from '../github/client.ts';
import type { ApiErrorResponse, QuotaResponse } from './contract.ts';
import type { QuotaStatus, VisitorQuota } from './quota.ts';
import { ServiceError, type BranchLoader, type DeliveryLoader } from './source.ts';

export interface ApiDependencies {
  readonly loadBranches: BranchLoader;
  readonly loadDelivery: DeliveryLoader;
  readonly now: () => Date;
  /** The daily allowance; absent when it is disabled, as in local development. */
  readonly quota?: VisitorQuota;
}

/** Who is asking, as far as the allowance is concerned (ADR 0008). */
export interface Visitor {
  /** Salted hash of the client address. */
  readonly id: string;
  /** The maintainer, signed in with the owner key: no daily allowance. */
  readonly owner: boolean;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: BranchReport | DeliveryReport | ApiErrorResponse;
  readonly headers?: Readonly<Record<string, string>>;
  /** Whether the repository data came from the cache; absent when none was loaded. */
  readonly cacheHit?: boolean;
}

/** Handles `GET /api/branches?repo=<owner>/<repo>[&staleDays=<n>]`. */
export async function handleBranchesRequest(
  query: URLSearchParams,
  dependencies: ApiDependencies,
  visitor: Visitor,
): Promise<ApiResponse> {
  const parsed = parseQuery(query);
  if ('status' in parsed) {
    return parsed;
  }
  const { repository, staleDays } = parsed;
  return withAllowance(repository, dependencies, visitor, (headers) =>
    report(repository, staleDays, dependencies, headers),
  );
}

/**
 * Handles `GET /api/delivery?repo=<owner>/<repo>`. It shares the allowance with branch
 * reports: a repository already analysed today costs nothing more.
 */
export async function handleDeliveryRequest(
  query: URLSearchParams,
  dependencies: ApiDependencies,
  visitor: Visitor,
): Promise<ApiResponse> {
  const repository = parseRepository(query.get('repo') ?? '');
  if (repository === null) {
    return failure(400, 'Expected a repository as <owner>/<repo>.');
  }
  return withAllowance(repository, dependencies, visitor, async (headers) => {
    const { delivery, cacheHit } = await dependencies.loadDelivery(repository);
    return {
      status: 200,
      body: buildDeliveryReport(delivery, { now: dependencies.now() }),
      headers,
      cacheHit,
    };
  });
}

/**
 * Runs a report within the visitor's daily allowance. The repository is reserved before
 * calling GitHub, so parallel requests cannot exceed the allowance.
 */
async function withAllowance(
  repository: RepositoryRef,
  dependencies: ApiDependencies,
  visitor: Visitor,
  run: (headers: Readonly<Record<string, string>>) => Promise<ApiResponse>,
): Promise<ApiResponse> {
  const quota = visitor.owner ? undefined : dependencies.quota;
  const name = `${repository.owner}/${repository.name}`;
  const reservation = await quota?.reserve(visitor.id, name);
  if (reservation?.allowed === false) {
    return quotaExceeded(reservation.status, dependencies.now());
  }
  try {
    return await run(reservation === undefined ? {} : quotaHeadersOf(reservation.status));
  } catch (error) {
    // A repository already counted earlier today stays counted.
    if (reservation?.charged === true) {
      await releaseIfNothingDelivered(error, quota, visitor.id, name);
    }
    return loadFailure(error);
  }
}

/**
 * A visitor is charged only for a report that exists or is on its way: a repository
 * that does not exist, a GitHub failure or a refusal to protect the quota give the
 * slot back. A timeout keeps it, because the load goes on and fills the cache, so
 * trying the same repository again is free and succeeds.
 */
async function releaseIfNothingDelivered(
  error: unknown,
  quota: VisitorQuota | undefined,
  visitor: string,
  repository: string,
): Promise<void> {
  const nothingDelivered =
    error instanceof GitHubError || (error instanceof ServiceError && error.status === 503);
  if (quota !== undefined && nothingDelivered) {
    await quota.release(visitor, repository);
  }
}

function parseQuery(
  query: URLSearchParams,
): { repository: RepositoryRef; staleDays: number } | ApiResponse {
  const repository = parseRepository(query.get('repo') ?? '');
  if (repository === null) {
    return failure(400, 'Expected a repository as <owner>/<repo>.');
  }
  const rawStaleDays = query.get('staleDays');
  const staleDays = rawStaleDays === null ? DEFAULT_STALE_DAYS : parseStaleDays(rawStaleDays);
  return staleDays === null
    ? failure(400, 'staleDays must be a positive whole number.')
    : { repository, staleDays };
}

/** Handles `GET /api/quota`: what the visitor has left today. */
export async function handleQuotaRequest(
  dependencies: ApiDependencies,
  visitor: Visitor,
): Promise<QuotaResponse> {
  if (visitor.owner || dependencies.quota === undefined) {
    return { owner: visitor.owner, limit: null, remaining: null, resetsAt: null };
  }
  const status = await dependencies.quota.status(visitor.id);
  return {
    owner: false,
    limit: status.limit,
    remaining: status.remaining,
    resetsAt: status.resetsAt?.toISOString() ?? null,
  };
}

async function report(
  repository: RepositoryRef,
  staleDays: number,
  dependencies: ApiDependencies,
  headers: Readonly<Record<string, string>>,
): Promise<ApiResponse> {
  const { branches, cacheHit } = await dependencies.loadBranches(repository);
  return {
    status: 200,
    body: buildBranchReport(branches, { now: dependencies.now(), staleDays }),
    headers,
    cacheHit,
  };
}

/** The allowance as response headers, which the interface reads after each report. */
function quotaHeadersOf(status: QuotaStatus): Record<string, string> {
  return {
    'x-quota-limit': String(status.limit),
    'x-quota-remaining': String(status.remaining),
    ...(status.resetsAt === null ? {} : { 'x-quota-reset': status.resetsAt.toISOString() }),
  };
}

function quotaExceeded(status: QuotaStatus, now: Date): ApiResponse {
  const resetsAt = status.resetsAt ?? now;
  return {
    status: 429,
    body: {
      error: `You have used your ${String(status.limit)} analyses for today. They come back at ${resetsAt.toISOString()}.`,
    },
    headers: {
      ...quotaHeadersOf(status),
      'retry-after': String(Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / 1000))),
    },
  };
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
