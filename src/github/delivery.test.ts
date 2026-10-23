import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GitHubClient } from './client.ts';
import { fetchDeliveryData } from './delivery.ts';

const NOW = new Date('2026-10-23T12:00:00Z');

interface Call {
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

/** Answers each GraphQL request by the kind of query it is, and records it. */
function fakeFetch(answers: { sample: unknown; counts: unknown }): {
  fetch: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const replay: typeof fetch = (_input, init) => {
    const body = JSON.parse(init?.body as string) as Call;
    calls.push(body);
    const answer = body.query.includes('releases') ? answers.sample : answers.counts;
    return Promise.resolve(Response.json(answer));
  };
  return { fetch: replay, calls };
}

const SAMPLE = {
  data: {
    repository: {
      pullRequests: {
        nodes: [
          {
            number: 7,
            title: 'Fix the parser',
            createdAt: '2026-10-20T00:00:00Z',
            mergedAt: '2026-10-21T00:00:00Z',
            additions: 12,
            deletions: 3,
            author: { login: 'alice', __typename: 'User' },
            reviews: { nodes: [{ createdAt: '2026-10-20T06:00:00Z', author: { login: 'bob' } }] },
          },
          {
            number: 8,
            title: 'Revert "Bump a dependency"',
            createdAt: '2026-10-21T00:00:00Z',
            mergedAt: '2026-10-21T01:00:00Z',
            additions: 2,
            deletions: 2,
            author: { login: 'dependabot', __typename: 'Bot' },
            reviews: { nodes: [] },
          },
          { number: 9, createdAt: '2026-10-21T00:00:00Z', mergedAt: null },
          {
            number: 3,
            title: 'Older than the window',
            createdAt: '2026-01-01T00:00:00Z',
            mergedAt: '2026-01-02T00:00:00Z',
            author: { login: 'carol', __typename: 'User' },
            reviews: { nodes: [] },
          },
        ],
      },
      releases: {
        nodes: [
          { tagName: 'v2.0.0', publishedAt: '2026-10-20T00:00:00Z', isPrerelease: false },
          { tagName: 'v2.1.0-draft', publishedAt: null, isPrerelease: false },
        ],
      },
    },
  },
};

function counts(merged = 340): unknown {
  const data: Record<string, { issueCount: number }> = {
    merged: { issueCount: merged },
    abandoned: { issueCount: 41 },
    staleOpen: { issueCount: 6 },
    reverts: { issueCount: 3 },
  };
  for (let week = 0; week < 12; week += 1) {
    data[`week${String(week)}`] = { issueCount: week };
  }
  return { data };
}

function client(fetchImpl: typeof fetch): GitHubClient {
  return new GitHubClient({ token: 'test-token', fetch: fetchImpl });
}

describe('fetchDeliveryData', () => {
  it('reads the merged sample, releases and counts of the last 90 days', async () => {
    const { fetch } = fakeFetch({ sample: SAMPLE, counts: counts() });

    const data = await fetchDeliveryData(client(fetch), 'acme', 'app', NOW);

    assert.equal(data.searchIndexed, true);
    assert.equal(data.mergedCount, 340);
    assert.deepEqual(
      data.sample.map((pullRequest) => [pullRequest.number, pullRequest.isBot]),
      [
        [7, false],
        [8, true],
      ],
    );
    assert.deepEqual(data.sample[0]?.reviews, [
      { author: 'bob', createdAt: new Date('2026-10-20T06:00:00Z') },
    ]);
    assert.deepEqual(data.releases, [
      { tag: 'v2.0.0', publishedAt: new Date('2026-10-20T00:00:00Z'), isPrerelease: false },
    ]);
    assert.equal(data.abandonedCount, 41);
    assert.equal(data.staleOpenCount, 6);
    assert.equal(data.revertCount, 3);
    // Oldest week first: week 11 ago down to the last seven days.
    assert.deepEqual(data.weeklyMerged, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it('searches by date windows, scoped to the repository', async () => {
    const { fetch, calls } = fakeFetch({ sample: SAMPLE, counts: counts() });

    await fetchDeliveryData(client(fetch), 'acme', 'app', NOW);

    const countQuery = calls.find((call) => !call.query.includes('releases'))?.query ?? '';
    assert.match(
      countQuery,
      /merged: search\(query: "repo:acme\/app is:pr is:merged merged:>=2026-07-25"/,
    );
    assert.match(
      countQuery,
      /week0: search\(query: "repo:acme\/app is:pr is:merged merged:2026-10-16\.\.2026-10-22"/,
    );
    assert.match(
      countQuery,
      /staleOpen: search\(query: "repo:acme\/app is:pr is:open updated:<2026-09-23"/,
    );
    assert.equal(calls.length, 2);
  });

  it('falls back on the sample for a repository that search does not index', async () => {
    const { fetch } = fakeFetch({ sample: SAMPLE, counts: counts(0) });

    const data = await fetchDeliveryData(client(fetch), 'facebook', 'react', NOW);

    assert.equal(data.searchIndexed, false);
    assert.equal(data.mergedCount, 2);
    assert.equal(data.revertCount, 1);
    assert.equal(data.abandonedCount, null);
    assert.equal(data.staleOpenCount, null);
    assert.deepEqual(data.weeklyMerged, []);
  });

  it('reports a missing repository as not found', async () => {
    const { fetch } = fakeFetch({
      sample: { data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: 'nope' }] },
      counts: { errors: [{ type: 'INVALID', message: 'cannot be searched' }] },
    });

    await assert.rejects(fetchDeliveryData(client(fetch), 'acme', 'missing', NOW), {
      name: 'GitHubError',
      message: 'Repository acme/missing was not found, or the token cannot access it.',
    });
  });
});
