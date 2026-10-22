import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';

import type { RepositoryBranches } from '../branches/report.ts';
import { GitHubClient } from '../github/client.ts';
import { createApp, type RequestLog, type UiHandler } from './app.ts';
import { TtlCache } from './cache.ts';
import { loadConfig } from './config.ts';
import { RateLimiter } from './rate-limit.ts';
import { createBranchLoader } from './source.ts';

// Quota protection (ADR 0007): the token allows 5,000 points per hour.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const QUOTA_RESERVE = 500;
const REPORT_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MAX_CLIENTS = 10_000;

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
  const loadBranches = createBranchLoader({
    client: new GitHubClient({ token, fetch: globalThis.fetch }),
    cache: new TtlCache<RepositoryBranches>({
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
      now: Date.now,
    }),
    now,
    quotaReserve: QUOTA_RESERVE,
    timeoutMs: REPORT_TIMEOUT_MS,
  });
  const server = createServer(
    createApp({
      config,
      api: { loadBranches, now },
      limiter: new RateLimiter({
        limitPerMinute: config.rateLimitPerMinute,
        maxClients: RATE_LIMIT_MAX_CLIENTS,
        now: Date.now,
      }),
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

export function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}
