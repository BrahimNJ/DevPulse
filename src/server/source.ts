import type { RepositoryRef } from '../branches/input.ts';
import type { RepositoryBranches } from '../branches/report.ts';
import type { DeliveryData } from '../delivery/report.ts';
import { fetchRepositoryBranches } from '../github/branches.ts';
import { fetchDeliveryData } from '../github/delivery.ts';
import type { GitHubClient } from '../github/client.ts';
import type { TtlCache } from './cache.ts';

export interface LoadedBranches {
  readonly branches: RepositoryBranches;
  readonly cacheHit: boolean;
}

export type BranchLoader = (repository: RepositoryRef) => Promise<LoadedBranches>;

/** The server chose not to answer now, to protect itself or the shared quota. */
export class ServiceError extends Error {
  readonly status: 503 | 504;
  readonly retryAfterSeconds: number | null;

  constructor(status: 503 | 504, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface LoaderOptions<T> {
  readonly client: GitHubClient;
  readonly cache: TtlCache<T>;
  readonly now: () => Date;
  /** GitHub is no longer called once the remaining quota falls below this many points. */
  readonly quotaReserve: number;
  readonly timeoutMs: number;
}

export type BranchLoaderOptions = LoaderOptions<RepositoryBranches>;

export interface LoadedDelivery {
  readonly delivery: DeliveryData;
  readonly cacheHit: boolean;
}

export type DeliveryLoader = (repository: RepositoryRef) => Promise<LoadedDelivery>;

/**
 * Reads repository data through the cache, so that anonymous visitors share one
 * GitHub token without exhausting it (ADR 0007). A load that times out keeps running
 * and fills the cache, so retrying a large repository a little later succeeds.
 */
function createCachedLoader<T extends { readonly owner: string; readonly name: string }>(
  options: LoaderOptions<T>,
  fetchData: (repository: RepositoryRef, now: Date) => Promise<T>,
): (repository: RepositoryRef) => Promise<{ value: T; cacheHit: boolean }> {
  return async (repository) => {
    // GitHub names are case-insensitive, so one entry serves every spelling.
    const key = `${repository.owner}/${repository.name}`.toLowerCase();
    const { value, hit } = await withTimeout(
      options.cache.getOrLoad(key, () => load(options, () => fetchData(repository, options.now()))),
      options.timeoutMs,
    );
    // Report the spelling this caller used, not the one that filled the cache.
    return { value: { ...value, owner: repository.owner, name: repository.name }, cacheHit: hit };
  };
}

export function createBranchLoader(options: BranchLoaderOptions): BranchLoader {
  const loader = createCachedLoader(options, (repository) =>
    fetchRepositoryBranches(options.client, repository.owner, repository.name),
  );
  return async (repository) => {
    const { value, cacheHit } = await loader(repository);
    return { branches: value, cacheHit };
  };
}

/** Delivery history of the last 90 days, cached like branch reports. */
export function createDeliveryLoader(options: LoaderOptions<DeliveryData>): DeliveryLoader {
  const loader = createCachedLoader(options, (repository, now) =>
    fetchDeliveryData(options.client, repository.owner, repository.name, now),
  );
  return async (repository) => {
    const { value, cacheHit } = await loader(repository);
    return { delivery: value, cacheHit };
  };
}

async function load<T>(options: LoaderOptions<T>, fetchData: () => Promise<T>): Promise<T> {
  const now = options.now();
  const quota = options.client.lowestQuota(now);
  if (quota !== null && quota.remaining < options.quotaReserve) {
    const seconds = Math.ceil((quota.resetsAt.getTime() - now.getTime()) / 1000);
    throw new ServiceError(
      503,
      'DevPulse has used its GitHub API budget for now. Try again later.',
      Math.max(1, seconds),
    );
  }
  return fetchData();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new ServiceError(504, 'GitHub is taking too long for this repository. Try again soon.'),
      );
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
