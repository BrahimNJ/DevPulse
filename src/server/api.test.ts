import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GitHubClient } from '../github/client.ts';
import { handleBranchesRequest, type ApiDependencies } from './api.ts';

const NOW = new Date('2026-10-20T00:00:00Z');

function dependencies(responses: readonly Response[]): ApiDependencies {
  const queue = [...responses];
  const fetch: typeof globalThis.fetch = () => {
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error('Unexpected request'))
      : Promise.resolve(next);
  };
  return { client: new GitHubClient({ token: 'test-token', fetch }), now: () => NOW };
}

const ONE_BRANCH = {
  data: {
    repository: {
      defaultBranchRef: { name: 'main' },
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
    const response = await handleBranchesRequest(
      new URLSearchParams({ repo: 'acme/app', staleDays: '30' }),
      dependencies([new Response(JSON.stringify(ONE_BRANCH)), new Response('[]')]),
    );

    assert.equal(response.status, 200);
    assert.ok('totals' in response.body);
    assert.equal(response.body.staleDays, 30);
    assert.deepEqual(response.body.totals, { branches: 1, protected: 0, stale: 0 });
  });

  it('rejects an invalid repository without calling GitHub', async () => {
    const response = await handleBranchesRequest(
      new URLSearchParams({ repo: 'not a repo' }),
      dependencies([]),
    );

    assert.deepEqual(response, {
      status: 400,
      body: { error: 'Expected a repository as <owner>/<repo>.' },
    });
  });

  it('rejects an invalid stale threshold', async () => {
    const response = await handleBranchesRequest(
      new URLSearchParams({ repo: 'acme/app', staleDays: '-1' }),
      dependencies([]),
    );

    assert.equal(response.status, 400);
  });

  it('maps a missing repository to 404 and other GitHub failures to 502', async () => {
    const notFound = await handleBranchesRequest(
      new URLSearchParams({ repo: 'acme/missing' }),
      dependencies([
        new Response(JSON.stringify({ errors: [{ type: 'NOT_FOUND', message: 'nope' }] })),
      ]),
    );
    const unavailable = await handleBranchesRequest(
      new URLSearchParams({ repo: 'acme/app' }),
      dependencies([new Response('', { status: 503 })]),
    );

    assert.equal(notFound.status, 404);
    assert.equal(unavailable.status, 502);
  });
});
