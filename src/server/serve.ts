import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';

import type { RepositoryBranches } from '../branches/report.ts';
import type { DeliveryData } from '../delivery/report.ts';
import { GitHubClient } from '../github/client.ts';
import type { Analytics } from './admin.ts';
import { MemoryEventStore } from './analytics.ts';
import { createApp, type RequestLog, type UiHandler } from './app.ts';
import { TtlCache } from './cache.ts';
import { loadConfig, type VisitorConfig } from './config.ts';
import { FirestoreEventStore } from './firestore-events.ts';
import { FirestoreQuotaStore } from './firestore-quota.ts';
import { metadataAccessToken } from './google-auth.ts';
import { OwnerAccess } from './owner.ts';
import { MemoryQuotaStore, VisitorQuota } from './quota.ts';
import { RateLimiter } from './rate-limit.ts';
import { createBranchLoader, createDeliveryLoader } from './source.ts';

// Quota protection (ADR 0007): the token allows 5,000 points per hour.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const QUOTA_RESERVE = 500;
const REPORT_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MAX_CLIENTS = 10_000;

// Daily allowance and maintainer access (ADR 0008).
const QUOTA_WINDOW_MS = 24 * 60 * 60_000;
const OWNER_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60_000;
const OWNER_ATTEMPTS_PER_MINUTE = 5;

// Usage statistics (ADR 0011).
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60_000;

export interface ServeOptions {
  /** How to start this mode with a token, shown when `GITHUB_TOKEN` is missing. */
  readonly example: string;
  readonly createUi: () => Promise<UiHandler>;
  readonly headers: Readonly<Record<string, string>>;
  readonly log: (entry: RequestLog) => void;
  readonly announce: (url: string) => void;
}

/** Validates the environment, then serves the API and the interface. */
export async function serve(options: ServeOptions): Promise<void> {
  const config = loadConfig(process.env);
  if (typeof config === 'string') {
    fail(config);
  }
  const token = process.env['GITHUB_TOKEN'];
  if (token === undefined || token === '') {
    fail(
      `GITHUB_TOKEN is not set. The GitHub GraphQL API requires a token,\nfor example: ${options.example}`,
    );
  }

  const now = (): Date => new Date();
  // One client for every report, so the quota guard sees all GitHub usage.
  const client = new GitHubClient({ token, fetch: globalThis.fetch });
  const protection = { client, now, quotaReserve: QUOTA_RESERVE, timeoutMs: REPORT_TIMEOUT_MS };
  const loadBranches = createBranchLoader({
    ...protection,
    cache: new TtlCache<RepositoryBranches>({
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
      now: Date.now,
    }),
  });
  const loadDelivery = createDeliveryLoader({
    ...protection,
    cache: new TtlCache<DeliveryData>({
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
      now: Date.now,
    }),
  });
  const server = createServer(
    createApp({
      config,
      api: { loadBranches, loadDelivery, now, ...visitorQuota(config.visitors, now) },
      limiter: new RateLimiter({
        limitPerMinute: config.rateLimitPerMinute,
        maxClients: RATE_LIMIT_MAX_CLIENTS,
        now: Date.now,
      }),
      ownerLimiter: new RateLimiter({
        limitPerMinute: OWNER_ATTEMPTS_PER_MINUTE,
        maxClients: RATE_LIMIT_MAX_CLIENTS,
        now: Date.now,
      }),
      visitors: {
        // Without an allowance, identifiers are never stored, so any salt will do.
        salt: config.visitors.salt ?? 'no-allowance',
        owner:
          config.visitors.ownerKey === null
            ? null
            : new OwnerAccess({
                key: config.visitors.ownerKey,
                // Behind Cloud Run every request arrives over HTTPS.
                secure: config.trustProxy,
                maxAgeMs: OWNER_COOKIE_MAX_AGE_MS,
              }),
      },
      analytics: analytics(config.visitors, client),
      ui: await options.createUi(),
      headers: options.headers,
      clock: () => performance.now(),
      log: options.log,
    }),
  );

  server.on('error', (error: NodeJS.ErrnoException) => {
    fail(
      error.code === 'EADDRINUSE'
        ? `Port ${String(config.port)} is already in use. Set PORT to use another one.`
        : error.message,
    );
  });
  // Cloud Run sends SIGTERM before stopping an instance: finish requests in flight. A
  // request still running after its grace period is cut by the platform, which is
  // acceptable for a read-only report.
  process.once('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  server.listen(config.port, config.host, () => {
    options.announce(`http://${config.host}:${String(config.port)}`);
  });
}

/** The daily allowance, in Firestore when deployed and in memory otherwise. */
function visitorQuota(
  visitors: VisitorConfig,
  now: () => Date,
): { quota: VisitorQuota } | Record<string, never> {
  if (visitors.quotaPerDay === null) {
    return {};
  }
  const store =
    visitors.firestoreProject === null
      ? new MemoryQuotaStore()
      : new FirestoreQuotaStore({
          project: visitors.firestoreProject,
          accessToken: metadataAccessToken(globalThis.fetch),
          fetch: globalThis.fetch,
        });
  return {
    quota: new VisitorQuota({ store, limit: visitors.quotaPerDay, windowMs: QUOTA_WINDOW_MS, now }),
  };
}

/** Analysis events, in Firestore when deployed and in memory otherwise. */
function analytics(visitors: VisitorConfig, client: GitHubClient): Analytics {
  const events =
    visitors.firestoreProject === null
      ? new MemoryEventStore()
      : new FirestoreEventStore({
          project: visitors.firestoreProject,
          accessToken: metadataAccessToken(globalThis.fetch),
          fetch: globalThis.fetch,
          retentionMs: EVENT_RETENTION_MS,
        });
  return {
    events,
    githubQuota: (now: Date) => client.lowestQuota(now),
    warn: (message: string): void => {
      process.stdout.write(`${JSON.stringify({ severity: 'WARNING', message })}\n`);
    },
  };
}

export function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
