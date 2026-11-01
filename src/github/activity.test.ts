import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchActivityData, StatisticsPendingError } from './activity.ts';
import { GitHubClient } from './client.ts';

const COMMIT_ACTIVITY = [
  { week: 1_761_350_400, total: 3, days: [0, 1, 2, 0, 0, 0, 0] },
  { week: 1_761_955_200, total: 1, days: [1, 0, 0, 0, 0, 0, 0] },
];

const CONTRIBUTORS = [
  {
    author: { login: 'ada', type: 'User' },
    total: 4,
    weeks: [
      { w: 1_761_955_200, a: 0, d: 0, c: 1 },
      { w: 1_761_350_400, a: 0, d: 0, c: 3 },
      { w: 1_760_745_600, a: 0, d: 0, c: 0 },
    ],
  },
  { author: { login: 'renovate[bot]', type: 'User' }, total: 2, weeks: [] },
  { author: null, total: 9, weeks: [] },
];

const PUNCH_CARD = [
  [2, 14, 6],
  [0, 22, 1],
];

interface Answer {
  readonly status: number;
  readonly body?: unknown;
}

/** Answers each statistic with the queued responses for its path, and records calls. */
function fakeFetch(answers: Readonly<Record<string, Answer[]>>): {
  fetch: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];
  const replay: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push(url);
    const key = Object.keys(answers).find((path) => url.endsWith(path)) ?? '';
    const answer = answers[key]?.shift() ?? { status: 500 };
    return Promise.resolve(
      answer.body === undefined
        ? new Response(null, { status: answer.status })
        : Response.json(answer.body, { status: answer.status }),
    );
  };
  return { fetch: replay, calls };
}

function client(fetchImpl: typeof fetch): GitHubClient {
  return new GitHubClient({ token: 'test-token', fetch: fetchImpl });
}

const NO_WAIT = { wait: (): Promise<void> => Promise.resolve() };

describe('fetchActivityData', () => {
  it('reads weekly commits, contributors and the punch card', async () => {
    const { fetch, calls } = fakeFetch({
      commit_activity: [{ status: 200, body: COMMIT_ACTIVITY }],
      contributors: [{ status: 200, body: CONTRIBUTORS }],
      punch_card: [{ status: 200, body: PUNCH_CARD }],
    });
    const data = await fetchActivityData(client(fetch), 'acme', 'app', NO_WAIT);

    assert.equal(calls.length, 3);
    assert.ok(calls.every((url) => url.startsWith('https://api.github.com/repos/acme/app/stats/')));
    assert.deepEqual(data.weeks[0], {
      start: new Date('2025-10-25T00:00:00Z'),
      days: [0, 1, 2, 0, 0, 0, 0],
      total: 3,
    });
    assert.deepEqual(data.contributors, [
      {
        login: 'ada',
        isBot: false,
        total: 4,
        weeks: [
          { start: new Date('2025-10-25T00:00:00Z'), commits: 3 },
          { start: new Date('2025-11-01T00:00:00Z'), commits: 1 },
        ],
      },
      { login: 'renovate[bot]', isBot: true, total: 2, weeks: [] },
    ]);
    assert.equal(data.truncated, false);
    assert.equal(data.punchCard.length, 7);
    assert.equal(data.punchCard[2]?.[14], 6);
    assert.equal(data.punchCard[0]?.[22], 1);
  });

  it('asks again while GitHub computes a statistic', async () => {
    const waits: number[] = [];
    const { fetch, calls } = fakeFetch({
      commit_activity: [
        { status: 202, body: {} },
        { status: 200, body: COMMIT_ACTIVITY },
      ],
      contributors: [{ status: 200, body: CONTRIBUTORS }],
      punch_card: [{ status: 200, body: PUNCH_CARD }],
    });
    const data = await fetchActivityData(client(fetch), 'acme', 'app', {
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });

    assert.equal(calls.length, 4);
    assert.deepEqual(waits, [3000]);
    assert.equal(data.weeks.length, 2);
  });

  it('gives up after three attempts, so the pending state is never cached', async () => {
    const pending = (): Answer[] => [
      { status: 202, body: {} },
      { status: 202, body: {} },
      { status: 202, body: {} },
    ];
    const { fetch, calls } = fakeFetch({
      commit_activity: pending(),
      contributors: [{ status: 200, body: CONTRIBUTORS }],
      punch_card: [{ status: 200, body: PUNCH_CARD }],
    });

    await assert.rejects(
      fetchActivityData(client(fetch), 'acme', 'app', NO_WAIT),
      StatisticsPendingError,
    );
    assert.equal(calls.length, 5);
  });

  it('counts deleted accounts towards the limit of 100 contributors', async () => {
    const hundred = Array.from({ length: 100 }, (_, index) =>
      index === 0 ? { author: null, total: 1, weeks: [] } : CONTRIBUTORS[0],
    );
    const { fetch } = fakeFetch({
      commit_activity: [{ status: 200, body: COMMIT_ACTIVITY }],
      contributors: [{ status: 200, body: hundred }],
      punch_card: [{ status: 200, body: PUNCH_CARD }],
    });
    const data = await fetchActivityData(client(fetch), 'acme', 'app', NO_WAIT);

    assert.equal(data.contributors.length, 99);
    assert.equal(data.truncated, true);
  });

  it('reads a repository without commits as empty', async () => {
    const { fetch } = fakeFetch({
      commit_activity: [{ status: 204 }],
      contributors: [{ status: 204 }],
      punch_card: [{ status: 204 }],
    });
    const data = await fetchActivityData(client(fetch), 'acme', 'empty', NO_WAIT);

    assert.deepEqual(data.weeks, []);
    assert.deepEqual(data.contributors, []);
    assert.equal(data.punchCard.flat().length, 7 * 24);
  });

  it('reports a missing repository before a pending statistic', async () => {
    const { fetch } = fakeFetch({
      commit_activity: [
        { status: 202, body: {} },
        { status: 202, body: {} },
        { status: 202, body: {} },
      ],
      contributors: [{ status: 404, body: { message: 'Not Found' } }],
      punch_card: [{ status: 404, body: { message: 'Not Found' } }],
    });

    await assert.rejects(fetchActivityData(client(fetch), 'acme', 'missing', NO_WAIT), {
      status: 404,
      message: 'Repository acme/missing was not found, or the token cannot access it.',
    });
  });
});
