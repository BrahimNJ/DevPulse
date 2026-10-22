import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run, type Environment } from './main.ts';

const DEFAULT_BRANCH = { data: { repository: { defaultBranchRef: { name: 'main' } } } };

const GRAPHQL_PAGE = {
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
            compare: { aheadBy: 0, behindBy: 0 },
          },
          {
            name: 'old-experiment',
            target: {
              oid: 'b2',
              committedDate: '2025-01-01T00:00:00Z',
              author: { name: 'Someone', user: null },
            },
            compare: { aheadBy: 48, behindBy: 12 },
          },
        ],
      },
    },
  },
};

interface Captured {
  stdout: string;
  stderr: string;
}

function environment(
  argv: readonly string[],
  env: Record<string, string> = { GITHUB_TOKEN: 'test-token' },
): { environment: Environment; output: Captured } {
  const output: Captured = { stdout: '', stderr: '' };
  const responses = [
    new Response(JSON.stringify(DEFAULT_BRANCH)),
    new Response(JSON.stringify(GRAPHQL_PAGE)),
    new Response(JSON.stringify([{ name: 'main' }])),
  ];
  const fake: Environment = {
    argv,
    env,
    fetch: () => {
      const next = responses.shift();
      return next === undefined
        ? Promise.reject(new Error('Unexpected request'))
        : Promise.resolve(next);
    },
    now: () => new Date('2026-10-20T00:00:00Z'),
    stdout: (text) => {
      output.stdout += text;
    },
    stderr: (text) => {
      output.stderr += text;
    },
  };
  return { environment: fake, output };
}

describe('run', () => {
  it('prints a table of branches', async () => {
    const { environment: env, output } = environment(['branches', 'acme/app']);

    assert.equal(await run(env), 0);
    assert.equal(
      output.stdout,
      [
        'acme/app: 2 branches, default main',
        'Protected: 1. Stale (no commit for 90+ days): 1.',
        '',
        'BRANCH          LAST COMMIT  AGE   AHEAD/BEHIND  AUTHOR   FLAGS',
        'main            2026-10-19   1d    -             octocat  default, protected',
        'old-experiment  2025-01-01   657d  +12/-48       Someone  stale',
        '',
      ].join('\n'),
    );
  });

  it('prints the report as JSON', async () => {
    const { environment: env, output } = environment(['branches', 'acme/app', '--json']);

    assert.equal(await run(env), 0);
    const report = JSON.parse(output.stdout) as {
      totals: unknown;
      branches: { name: string; lastCommit: { date: string }; divergence: unknown }[];
    };
    assert.deepEqual(report.totals, { branches: 2, protected: 1, stale: 1 });
    assert.equal(report.branches[0]?.lastCommit.date, '2026-10-19T00:00:00.000Z');
    assert.deepEqual(report.branches[1]?.divergence, { ahead: 12, behind: 48 });
  });

  it('fails without a token and explains how to provide one', async () => {
    const { environment: env, output } = environment(['branches', 'acme/app'], {});

    assert.equal(await run(env), 1);
    assert.match(output.stderr, /GITHUB_TOKEN is not set/);
    assert.equal(output.stdout, '');
  });

  it('exits with code 2 and shows usage on invalid arguments', async () => {
    const { environment: env, output } = environment(['branches']);

    assert.equal(await run(env), 2);
    assert.match(output.stderr, /Usage: devpulse branches/);
  });
});
