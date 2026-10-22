import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RepositoryBranches } from '../branches/report.ts';
import { GitHubClient, GitHubError } from '../github/client.ts';
import {
  handleBranchesRequest,
  handleQuotaRequest,
  type ApiDependencies,
  type Visitor,
} from './api.ts';
import { TtlCache } from './cache.ts';
import { MemoryQuotaStore, VisitorQuota } from './quota.ts';
import { createBranchLoader, ServiceError } from './source.ts';

const NOW = new Date('2026-10-20T00:00:00Z');
const VISITOR: Visitor = { id: 'visitor', owner: false };

/** Calls the handler as an ordinary visitor. */
function ask(
  query: URLSearchParams,
  deps: ApiDependencies,
): ReturnType<typeof handleBranchesRequest> {
  return handleBranchesRequest(query, deps, VISITOR);
}

function dependencies(responses: readonly Response[]): ApiDependencies {
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = () => {
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error('Unexpected request'))
      : Promise.resolve(next);
  };
  const loadBranches = createBranchLoader({
    client: new GitHubClient({ token: 'test-token', fetch }),
    cache: new TtlCache<RepositoryBranches>({ ttlMs: 1000, maxEntries: 10, now: (): number => 0 }),
    now: () => NOW,
    quotaReserve: 0,
    timeoutMs: 1000,
  });
  return { loadBranches, now: () => NOW };
}

const DEFAULT_BRANCH = { data: { repository: { defaultBranchRef: { name: 'main' } } } };

const ONE_BRANCH = {
  data: {
    repository: {
      refs: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            name: 'main',
            target: {
              oid: 'a1',
              committedDate: '2026-10-19T00:00:00Z',
              author: { name: 'Octo Cat', user: { login: 'octocat' } },
            },
          },
        ],
      },
    },
  },
};

describe('handleBranchesRequest', () => {
  it('returns the branch report for a valid repository', async () => {
    const response = await ask(
      new URLSearchParams({ repo: 'acme/app', staleDays: '30' }),
      dependencies([
        new Response(JSON.stringify(DEFAULT_BRANCH)),
        new Response(JSON.stringify(ONE_BRANCH)),
        new Response('[]'),
      ]),
    );

    assert.equal(response.status, 200);
    assert.ok('totals' in response.body);
    assert.equal(response.body.staleDays, 30);
    assert.deepEqual(response.body.totals, { branches: 1, protected: 0, stale: 0 });
  });

  it('rejects an invalid repository without calling GitHub', async () => {
    const response = await ask(new URLSearchParams({ repo: 'not a repo' }), dependencies([]));

    assert.deepEqual(response, {
      status: 400,
      body: { error: 'Expected a repository as <owner>/<repo>.' },
    });
  });

  it('rejects an invalid stale threshold', async () => {
    const response = await ask(
      new URLSearchParams({ repo: 'acme/app', staleDays: '-1' }),
      dependencies([]),
    );

    assert.equal(response.status, 400);
  });

  it('maps a missing repository to 404 and other GitHub failures to 502', async () => {
    const notFound = await ask(
      new URLSearchParams({ repo: 'acme/missing' }),
      dependencies([
        new Response(JSON.stringify({ errors: [{ type: 'NOT_FOUND', message: 'nope' }] })),
      ]),
    );
    const unavailable = await ask(
      new URLSearchParams({ repo: 'acme/app' }),
      dependencies([new Response('', { status: 503 })]),
    );

    assert.equal(notFound.status, 404);
    assert.equal(unavailable.status, 502);
  });

  it('reports whether the repository data came from the cache', async () => {
    const deps = dependencies([
      new Response(JSON.stringify(DEFAULT_BRANCH)),
      new Response(JSON.stringify(ONE_BRANCH)),
      new Response('[]'),
    ]);
    const query = new URLSearchParams({ repo: 'acme/app' });

    assert.equal((await ask(query, deps)).cacheHit, false);
    assert.equal((await ask(query, deps)).cacheHit, true);
  });

  it('passes a protective refusal on with its retry delay', async () => {
    const response = await ask(new URLSearchParams({ repo: 'acme/app' }), {
      loadBranches: () => Promise.reject(new ServiceError(503, 'Budget used.', 120)),
      now: () => NOW,
    });

    assert.deepEqual(response, {
      status: 503,
      body: { error: 'Budget used.' },
      headers: { 'retry-after': '120' },
    });
  });
});

describe('daily allowance', () => {
  const EMPTY: RepositoryBranches = { owner: 'a', name: 'b', defaultBranch: null, branches: [] };

  function withQuota(load: ApiDependencies['loadBranches']): ApiDependencies {
    return {
      loadBranches: load,
      now: () => NOW,
      quota: new VisitorQuota({
        store: new MemoryQuotaStore(),
        limit: 2,
        windowMs: 86_400_000,
        now: () => NOW,
      }),
    };
  }

  const found = (): ReturnType<ApiDependencies['loadBranches']> =>
    Promise.resolve({ branches: EMPTY, cacheHit: false });

  it('counts distinct repositories, reports what is left, then refuses', async () => {
    const deps = withQuota(found);
    const query = (repo: string): URLSearchParams => new URLSearchParams({ repo });

    const first = await ask(query('a/one'), deps);
    await ask(query('a/one'), deps);
    await ask(query('a/two'), deps);
    const refused = await ask(query('a/three'), deps);

    assert.equal(first.headers?.['x-quota-remaining'], '1');
    assert.equal(refused.status, 429);
    assert.equal(refused.headers?.['retry-after'], '86400');
    assert.match((refused.body as { error: string }).error, /used your 2 analyses/);
  });

  it('does not charge a repository that does not exist', async () => {
    const deps = withQuota(() => Promise.reject(new GitHubError('Not found.', 404)));

    const response = await ask(new URLSearchParams({ repo: 'a/missing' }), deps);

    assert.equal(response.status, 404);
    assert.deepEqual(await handleQuotaRequest(deps, VISITOR), {
      owner: false,
      limit: 2,
      remaining: 2,
      resetsAt: null,
    });
  });

  it('gives the slot back when GitHub fails or the quota is protected, not on a timeout', async () => {
    const failing = (error: Error): ApiDependencies => withQuota(() => Promise.reject(error));
    const remainingAfter = async (deps: ApiDependencies): Promise<number | null> => {
      await ask(new URLSearchParams({ repo: 'a/one' }), deps);
      return (await handleQuotaRequest(deps, VISITOR)).remaining;
    };

    assert.equal(await remainingAfter(failing(new GitHubError('Bad gateway.', 502))), 2);
    assert.equal(await remainingAfter(failing(new ServiceError(503, 'Reserve.', 60))), 2);
    assert.equal(await remainingAfter(failing(new ServiceError(504, 'Slow.'))), 1);
  });

  it('lets the owner analyse without limit', async () => {
    const deps = withQuota(found);
    const owner: Visitor = { id: 'visitor', owner: true };

    for (const repo of ['a/one', 'a/two', 'a/three', 'a/four']) {
      const response = await handleBranchesRequest(new URLSearchParams({ repo }), deps, owner);
      assert.equal(response.status, 200, repo);
    }
    assert.deepEqual(await handleQuotaRequest(deps, owner), {
      owner: true,
      limit: null,
      remaining: null,
      resetsAt: null,
    });
  });

  it('reports no allowance when it is disabled, as in local development', async () => {
    assert.deepEqual(await handleQuotaRequest({ loadBranches: found, now: () => NOW }, VISITOR), {
      owner: false,
      limit: null,
      remaining: null,
      resetsAt: null,
    });
  });
});
