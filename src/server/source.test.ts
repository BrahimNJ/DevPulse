import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RepositoryBranches } from '../branches/report.ts';
import { GitHubClient } from '../github/client.ts';
import { TtlCache } from './cache.ts';
import { createBranchLoader, ServiceError, type BranchLoader } from './source.ts';

const NOW = new Date('2026-10-20T00:00:00Z');
/** 90 seconds after NOW, in the epoch seconds that GitHub uses for `x-ratelimit-reset`. */
const RESET = String(NOW.getTime() / 1000 + 90);

function json(body: unknown, remaining = 4000): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'x-ratelimit-remaining': String(remaining), 'x-ratelimit-reset': RESET },
  });
}

/** The three responses of one uncached report of an empty repository. */
function report(remaining = 4000): Response[] {
  return [
    json({ data: { repository: { defaultBranchRef: null } } }, remaining),
    json({
      data: { repository: { refs: { pageInfo: { hasNextPage: false }, nodes: [] } } },
    }),
    json([], remaining),
  ];
}

function loader(
  responses: readonly Response[],
  options: { quotaReserve?: number; timeoutMs?: number } = {},
): BranchLoader {
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = () => {
    const next = queue.shift();
    // An exhausted queue never answers, which stands for a slow GitHub.
    return next === undefined ? new Promise<Response>(() => undefined) : Promise.resolve(next);
  };
  return createBranchLoader({
    client: new GitHubClient({ token: 'test-token', fetch }),
    cache: new TtlCache<RepositoryBranches>({ ttlMs: 60_000, maxEntries: 10, now: () => 0 }),
    now: () => NOW,
    quotaReserve: options.quotaReserve ?? 100,
    timeoutMs: options.timeoutMs ?? 1000,
  });
}

describe('createBranchLoader', () => {
  it('serves every spelling of a repository from one cache entry', async () => {
    const load = loader(report());

    const first = await load({ owner: 'Acme', name: 'App' });
    const second = await load({ owner: 'acme', name: 'app' });

    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.equal(second.branches.owner, 'acme');
    assert.equal(second.branches.name, 'app');
  });

  it('stops calling GitHub when the quota falls below the reserve', async () => {
    const load = loader(report(50), { quotaReserve: 100 });
    await load({ owner: 'acme', name: 'first' });

    await assert.rejects(load({ owner: 'acme', name: 'second' }), (error: unknown) => {
      assert.ok(error instanceof ServiceError);
      assert.equal(error.status, 503);
      assert.equal(error.retryAfterSeconds, 90);
      return true;
    });
    // Cached repositories are still served while the quota recovers.
    assert.equal((await load({ owner: 'acme', name: 'first' })).cacheHit, true);
  });

  it('gives up on a repository that GitHub is too slow to report', async () => {
    const load = loader([], { timeoutMs: 5 });

    await assert.rejects(load({ owner: 'acme', name: 'huge' }), { name: 'ServiceError' });
  });
});
