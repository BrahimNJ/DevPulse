import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchRepositoryBranches } from './branches.ts';
import { GitHubClient, GitHubError, nextPageUrl } from './client.ts';

interface Call {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** A fetch that replays canned responses in order and records every request. */
function fakeFetch(responses: readonly Response[]): {
  fetch: typeof globalThis.fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const queue = [...responses];
  const replay: typeof globalThis.fetch = (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error('Unexpected request'))
      : Promise.resolve(next);
  };
  return { fetch: replay, calls };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

function refsPage(names: readonly string[], endCursor: string | null): Response {
  return json({
    data: {
      repository: {
        defaultBranchRef: { name: 'main' },
        refs: {
          pageInfo: { hasNextPage: endCursor !== null, endCursor },
          nodes: names.map((name) => ({
            name,
            target: {
              oid: `sha-${name}`,
              committedDate: '2026-10-01T00:00:00Z',
              author: { name: 'Git Name', user: name === 'main' ? { login: 'octocat' } : null },
            },
          })),
        },
      },
    },
  });
}

function client(fetch: typeof globalThis.fetch): GitHubClient {
  return new GitHubClient({ token: 'test-token', fetch });
}

describe('fetchRepositoryBranches', () => {
  it('follows GraphQL and REST pagination and merges protection status', async () => {
    const { fetch, calls } = fakeFetch([
      refsPage(['main', 'dev'], 'cursor-1'),
      refsPage(['feature'], null),
      json([{ name: 'main' }], {
        headers: { link: '<https://api.github.com/repositories/1/branches?page=2>; rel="next"' },
      }),
      json([{ name: 'dev' }]),
    ]);

    const result = await fetchRepositoryBranches(client(fetch), 'acme', 'app');

    assert.equal(result.defaultBranch, 'main');
    assert.deepEqual(
      result.branches.map((b) => [b.name, b.isProtected, b.lastCommit.author]),
      [
        ['main', true, 'octocat'],
        ['dev', true, 'Git Name'],
        ['feature', false, 'Git Name'],
      ],
    );
    assert.equal(calls.length, 4);
    const secondQuery = JSON.parse(calls[1]?.init?.body as string) as { variables: unknown };
    assert.deepEqual(secondQuery.variables, { owner: 'acme', name: 'app', cursor: 'cursor-1' });
    assert.equal(
      calls[2]?.url,
      'https://api.github.com/repos/acme/app/branches?protected=true&per_page=100',
    );
  });

  it('sends the token as a bearer authorization header', async () => {
    const { fetch, calls } = fakeFetch([refsPage([], null), json([])]);

    await fetchRepositoryBranches(client(fetch), 'acme', 'app');

    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers['authorization'], 'Bearer test-token');
  });

  it('reports a missing repository clearly', async () => {
    const { fetch } = fakeFetch([
      json({ data: { repository: null }, errors: [{ type: 'NOT_FOUND', message: 'nope' }] }),
    ]);

    await assert.rejects(fetchRepositoryBranches(client(fetch), 'acme', 'missing'), {
      name: 'GitHubError',
      message: 'Repository acme/missing was not found, or the token cannot access it.',
    });
  });

  it('reports a rejected token', async () => {
    const { fetch } = fakeFetch([json({}, { status: 401 })]);

    await assert.rejects(fetchRepositoryBranches(client(fetch), 'acme', 'app'), {
      message: 'GitHub rejected the token (401). Check GITHUB_TOKEN.',
    });
  });

  it('reports an exhausted rate limit with its reset time', async () => {
    const { fetch } = fakeFetch([
      json(
        {},
        { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0' } },
      ),
    ]);

    await assert.rejects(fetchRepositoryBranches(client(fetch), 'acme', 'app'), {
      message: 'GitHub API rate limit exceeded until 1970-01-01T00:00:00.000Z.',
    });
  });

  it('reports a secondary rate limit with its retry delay', async () => {
    const { fetch } = fakeFetch([json({}, { status: 403, headers: { 'retry-after': '60' } })]);

    await assert.rejects(fetchRepositoryBranches(client(fetch), 'acme', 'app'), {
      message: 'GitHub secondary rate limit hit; retry after 60 seconds.',
    });
  });

  it('reports a network failure without a stack trace', async () => {
    const failing: typeof globalThis.fetch = () => Promise.reject(new TypeError('fetch failed'));

    await assert.rejects(fetchRepositoryBranches(client(failing), 'acme', 'app'), {
      name: 'GitHubError',
      message: 'Could not reach GitHub: fetch failed',
    });
  });

  it('reports a response that is not JSON', async () => {
    const { fetch } = fakeFetch([new Response('<html>Bad gateway</html>')]);

    await assert.rejects(fetchRepositoryBranches(client(fetch), 'acme', 'app'), {
      name: 'GitHubError',
      message: 'GitHub returned a response that is not valid JSON.',
    });
  });

  it('resolves a relative pagination link against the current page', async () => {
    const { fetch, calls } = fakeFetch([
      refsPage([], null),
      json([], { headers: { link: '</repos/acme/app/branches?page=2>; rel="next"' } }),
      json([]),
    ]);

    await fetchRepositoryBranches(client(fetch), 'acme', 'app');

    assert.equal(calls[2]?.url, 'https://api.github.com/repos/acme/app/branches?page=2');
  });

  it('refuses to send the token to a pagination link on another host', async () => {
    const { fetch } = fakeFetch([
      refsPage([], null),
      json([], { headers: { link: '<https://evil.example/branches?page=2>; rel="next"' } }),
    ]);

    await assert.rejects(
      fetchRepositoryBranches(client(fetch), 'acme', 'app'),
      (error: unknown) => error instanceof GitHubError && error.message.includes('evil.example'),
    );
  });
});

describe('nextPageUrl', () => {
  it('returns the next link, or null when there is none', () => {
    const link = '<https://x/a?page=2>; rel="next", <https://x/a?page=5>; rel="last"';
    assert.equal(nextPageUrl(link), 'https://x/a?page=2');
    assert.equal(nextPageUrl('<https://x/a?page=1>; rel="prev"'), null);
    assert.equal(nextPageUrl(null), null);
  });
});
