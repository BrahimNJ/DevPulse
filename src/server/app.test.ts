import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RepositoryBranches } from '../branches/report.ts';
import type { Analytics } from './admin.ts';
import { MemoryEventStore, type AdminStats } from './analytics.ts';
import { createApp, PRODUCTION_HEADERS, type AppOptions, type RequestLog } from './app.ts';
import { loadConfig } from './config.ts';
import { withServer } from './http-test.ts';
import { OwnerAccess } from './owner.ts';
import { MemoryQuotaStore, VisitorQuota } from './quota.ts';
import { RateLimiter } from './rate-limit.ts';
import type { DeliveryData } from '../delivery/report.ts';
import type { BranchLoader, DeliveryLoader } from './source.ts';

const NOW = new Date('2026-10-20T00:00:00Z');

const DELIVERY: DeliveryData = {
  owner: 'acme',
  name: 'app',
  windowDays: 90,
  searchIndexed: true,
  mergedCount: 0,
  sample: [],
  abandonedCount: 0,
  staleOpenCount: 0,
  revertCount: 0,
  weeklyMerged: [],
  releases: [],
};

const OWNER_KEY = 'an-owner-key-for-the-tests';

const EMPTY: RepositoryBranches = { owner: 'acme', name: 'app', defaultBranch: null, branches: [] };

function options(
  overrides: {
    loadBranches?: BranchLoader;
    limitPerMinute?: number;
    quota?: number;
    analytics?: Analytics;
  } = {},
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
      loadDelivery: (): ReturnType<DeliveryLoader> =>
        Promise.resolve({ delivery: DELIVERY, cacheHit: false }),
      now: () => NOW,
      ...(overrides.quota === undefined
        ? {}
        : {
            quota: new VisitorQuota({
              store: new MemoryQuotaStore(),
              limit: overrides.quota,
              windowMs: 86_400_000,
              now: () => NOW,
            }),
          }),
    },
    limiter: new RateLimiter({
      limitPerMinute: overrides.limitPerMinute ?? 10,
      maxClients: 10,
      now: () => 0,
    }),
    ownerLimiter: new RateLimiter({ limitPerMinute: 2, maxClients: 10, now: () => 0 }),
    visitors: {
      salt: 'a-salt-for-the-tests',
      owner: new OwnerAccess({ key: OWNER_KEY, secure: false, maxAgeMs: 86_400_000 }),
    },
    ...(overrides.analytics === undefined ? {} : { analytics: overrides.analytics }),
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

  it('serves a delivery report that shares the allowance of the repository', async () => {
    await withServer(createApp(options({ quota: 1 })), async (send) => {
      const branches = await send('/api/branches?repo=acme/app');
      const delivery = await send('/api/delivery?repo=acme/app');

      assert.equal(branches.status, 200);
      assert.equal(delivery.status, 200);
      assert.equal(delivery.headers['x-quota-remaining'], '0');
      assert.equal((JSON.parse(delivery.body) as { repository: string }).repository, 'acme/app');
      assert.equal((await send('/api/delivery?repo=acme/other')).status, 429);
    });
  });

  it('reports the allowance and lets the owner sign in and out', async () => {
    await withServer(createApp(options({ quota: 1 })), async (send) => {
      const post = (key: string, origin = 'http://devpulse.test'): ReturnType<typeof send> =>
        send('/api/owner', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ key }),
        });

      await send('/api/branches?repo=acme/app');
      assert.equal((await send('/api/branches?repo=acme/other')).status, 429);
      assert.deepEqual(JSON.parse((await send('/api/quota')).body), {
        owner: false,
        limit: 1,
        remaining: 0,
        resetsAt: '2026-10-21T00:00:00.000Z',
      });

      assert.equal((await post('wrong key')).status, 401);
      assert.equal((await post(OWNER_KEY, 'https://evil.example')).status, 403);
      const signIn = await post(OWNER_KEY);
      const cookie = String(signIn.headers['set-cookie']).split(';')[0] ?? '';

      assert.equal(signIn.status, 200);
      assert.match(String(signIn.headers['set-cookie']), /HttpOnly; SameSite=Strict/);
      const asOwner = { headers: { cookie } };
      assert.equal((await send('/api/branches?repo=acme/other', asOwner)).status, 200);
      assert.equal(
        (JSON.parse((await send('/api/quota', asOwner)).body) as { owner: boolean }).owner,
        true,
      );

      const signOut = await send('/api/owner', { method: 'DELETE', headers: { cookie } });
      assert.match(String(signOut.headers['set-cookie']), /Max-Age=0/);
    });
  });

  it('limits attempts to guess the owner key', async () => {
    await withServer(createApp(options()), async (send) => {
      const attempt = (): ReturnType<typeof send> =>
        send('/api/owner', { method: 'POST', body: '{"key":"guess"}' });

      assert.equal((await attempt()).status, 401);
      assert.equal((await attempt()).status, 401);
      assert.equal((await attempt()).status, 429);
    });
  });

  it('compresses a large JSON response for a client that accepts it', async () => {
    const many: RepositoryBranches = {
      ...EMPTY,
      branches: Array.from({ length: 200 }, (_, index) => ({
        name: `feature/branch-${String(index)}`,
        isProtected: false,
        lastCommit: { sha: 'a'.repeat(40), date: NOW, author: 'someone' },
        divergence: null,
      })),
    };
    const app = options({
      loadBranches: (): ReturnType<BranchLoader> =>
        Promise.resolve({ branches: many, cacheHit: true }),
    });
    await withServer(createApp(app), async (send) => {
      const compressed = await send('/api/branches?repo=acme/app', {
        headers: { 'accept-encoding': 'gzip' },
      });
      const plain = await send('/api/branches?repo=acme/app');

      assert.equal(compressed.headers['content-encoding'], 'gzip');
      assert.equal(compressed.headers['vary'], 'accept-encoding');
      assert.ok(Number(compressed.headers['content-length']) < plain.body.length / 5);
      assert.equal(plain.headers['content-encoding'], undefined);
    });
  });

  it('records analyses and shows statistics to the owner only', async () => {
    const warnings: string[] = [];
    const analytics: Analytics = {
      events: new MemoryEventStore(),
      githubQuota: () => ({ remaining: 4200, resetsAt: new Date('2026-10-20T01:00:00Z') }),
      warn: (message) => warnings.push(message),
    };
    await withServer(createApp(options({ quota: 1, analytics })), async (send) => {
      const visitor = {
        headers: { 'user-agent': 'Mozilla/5.0 (iPhone)', 'accept-language': 'fr-FR,fr' },
      };
      await send('/api/branches?repo=Acme/App', visitor);
      await send('/api/delivery?repo=acme/app', visitor);
      await send('/api/branches?repo=acme/other', visitor);
      await send('/api/branches?repo=not-a-repository', visitor);

      assert.equal((await send('/api/admin/stats')).status, 404);
      const signIn = await send('/api/owner', {
        method: 'POST',
        headers: { origin: 'http://devpulse.test', 'content-type': 'application/json' },
        body: JSON.stringify({ key: OWNER_KEY }),
      });
      const asOwner = {
        headers: { cookie: String(signIn.headers['set-cookie']).split(';')[0] ?? '' },
      };
      await send('/api/branches?repo=owner/own', asOwner);
      const response = await send('/api/admin/stats?days=30', asOwner);

      assert.equal(response.status, 200);
      assert.equal(response.headers['cache-control'], 'no-store');
      const stats = JSON.parse(response.body) as AdminStats;
      assert.equal(stats.days, 30);
      assert.deepEqual(stats.totals, {
        visitors: 1,
        analyses: 3,
        succeeded: 1,
        failed: 2,
        deliveryOpened: 1,
        repositories: 2,
        cacheHitRate: 0.5,
        medianMs: 0,
        p90Ms: 0,
        allowanceReached: 1,
      });
      assert.deepEqual(stats.outcomes, [
        { outcome: 'allowance', count: 1 },
        { outcome: 'invalid', count: 1 },
      ]);
      assert.deepEqual(stats.repositories[0], { name: 'acme/app', analyses: 1, failed: 0 });
      assert.deepEqual(stats.devices, { mobile: 3, desktop: 0, bot: 0 });
      assert.deepEqual(stats.languages, { fr: 3, en: 0, other: 0 });
      assert.deepEqual(stats.github, { remaining: 4200, resetsAt: '2026-10-20T01:00:00.000Z' });
      assert.deepEqual(warnings, []);
    });
  });

  it('answers the visitor even when an analysis cannot be recorded', async () => {
    const warnings: string[] = [];
    const analytics: Analytics = {
      events: {
        add: () => Promise.reject(new Error('Firestore is down')),
        recent: () => Promise.resolve([]),
      },
      githubQuota: () => null,
      warn: (message) => warnings.push(message),
    };
    await withServer(createApp(options({ analytics })), async (send) => {
      assert.equal((await send('/api/branches?repo=acme/app')).status, 200);
      assert.deepEqual(warnings, ['Could not record an analysis: Firestore is down']);
    });
  });
});
