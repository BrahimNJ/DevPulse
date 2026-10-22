import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RepositoryBranches } from '../branches/report.ts';
import { createApp, PRODUCTION_HEADERS, type AppOptions, type RequestLog } from './app.ts';
import { loadConfig } from './config.ts';
import { withServer } from './http-test.ts';
import { RateLimiter } from './rate-limit.ts';
import type { BranchLoader } from './source.ts';

const NOW = new Date('2026-10-20T00:00:00Z');

const EMPTY: RepositoryBranches = { owner: 'acme', name: 'app', defaultBranch: null, branches: [] };

function options(
  overrides: { loadBranches?: BranchLoader; limitPerMinute?: number } = {},
): AppOptions & { logs: RequestLog[] } {
  const config = loadConfig({ ALLOWED_HOSTS: 'devpulse.test' });
  assert.ok(typeof config !== 'string');
  const logs: RequestLog[] = [];
  return {
    config,
    api: {
      loadBranches:
        overrides.loadBranches ??
        ((): ReturnType<BranchLoader> => Promise.resolve({ branches: EMPTY, cacheHit: true })),
      now: () => NOW,
    },
    limiter: new RateLimiter({
      limitPerMinute: overrides.limitPerMinute ?? 10,
      maxClients: 10,
      now: () => 0,
    }),
    ui: (request, response, next): void => {
      if (request.url === '/') {
        response.end('interface');
        return;
      }
      next();
    },
    headers: PRODUCTION_HEADERS,
    clock: () => 0,
    log: (entry) => logs.push(entry),
    logs,
  };
}

describe('createApp', () => {
  it('serves the report with security headers and logs a cache hit', async () => {
    const app = options();
    await withServer(createApp(app), async (send) => {
      const response = await send('/api/branches?repo=acme/app');

      assert.equal(response.status, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.match(String(response.headers['content-security-policy']), /default-src 'self'/);
      assert.equal((JSON.parse(response.body) as { repository: string }).repository, 'acme/app');
    });
    assert.deepEqual(app.logs[0], {
      severity: 'INFO',
      message: 'GET /api/branches?repo=acme/app 200',
      route: 'api',
      httpRequest: {
        requestMethod: 'GET',
        requestUrl: '/api/branches?repo=acme/app',
        status: 200,
        latency: '0.000s',
      },
      cacheHit: true,
    });
  });

  it('rejects a Host it does not answer to, except for health checks', async () => {
    await withServer(createApp(options()), async (send) => {
      const rebound = await send('/api/branches?repo=acme/app', {
        headers: { host: 'attacker.example' },
      });
      const health = await send('/health', { headers: { host: '10.0.0.7:8080' } });

      assert.equal(rebound.status, 403);
      assert.equal(health.status, 200);
      assert.deepEqual(JSON.parse(health.body), { status: 'ok' });
    });
  });

  it('limits each client and tells it when to retry', async () => {
    await withServer(createApp(options({ limitPerMinute: 1 })), async (send) => {
      assert.equal((await send('/api/branches?repo=acme/app')).status, 200);
      const limited = await send('/api/branches?repo=acme/app');

      assert.equal(limited.status, 429);
      assert.equal(limited.headers['retry-after'], '60');
    });
  });

  it('accepts only GET on the API and routes other paths to the interface', async () => {
    await withServer(createApp(options()), async (send) => {
      const post = await send('/api/branches?repo=acme/app', { method: 'POST' });

      assert.equal(post.status, 405);
      assert.equal(post.headers['allow'], 'GET');
      assert.equal((await send('/api/unknown')).status, 404);
      assert.equal((await send('/')).body, 'interface');
      assert.equal((await send('/missing.js')).status, 404);
    });
  });

  it('answers 500 and logs an error when the API fails unexpectedly', async () => {
    const app = options({ loadBranches: () => Promise.reject(new Error('bug')) });
    await withServer(createApp(app), async (send) => {
      const response = await send('/api/branches?repo=acme/app');

      assert.equal(response.status, 500);
      assert.deepEqual(JSON.parse(response.body), { error: 'Unexpected server error.' });
    });
    const [entry] = app.logs;
    assert.ok(entry);
    assert.equal(entry.severity, 'ERROR');
    assert.match(entry.error ?? '', /Error: bug/);
  });
});
