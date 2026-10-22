import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createServer as createViteServer } from 'vite';

import type { RepositoryBranches } from '../branches/report.ts';
import { GitHubClient } from '../github/client.ts';
import { handleBranchesRequest, type ApiDependencies } from './api.ts';
import { TtlCache } from './cache.ts';
import { loadConfig } from './config.ts';
import { isAllowedHost } from './host.ts';
import { createBranchLoader } from './source.ts';

// Quota protection (ADR 0007): the token allows 5,000 points per hour.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const QUOTA_RESERVE = 500;
const REPORT_TIMEOUT_MS = 30_000;

// Local only by default: the server holds a GitHub token (see config.ts).
const config = loadConfig(process.env);
const token = process.env['GITHUB_TOKEN'];

if (typeof config === 'string') {
  fail(config);
}
const { host, port } = config;
if (token === undefined || token === '') {
  fail(
    'GITHUB_TOKEN is not set. The GitHub GraphQL API requires a token,\n' +
      'for example: GITHUB_TOKEN=$(gh auth token) npm run web',
  );
}

const now = (): Date => new Date();
const dependencies: ApiDependencies = {
  loadBranches: createBranchLoader({
    client: new GitHubClient({ token, fetch: globalThis.fetch }),
    cache: new TtlCache<RepositoryBranches>({
      ttlMs: CACHE_TTL_MS,
      maxEntries: CACHE_MAX_ENTRIES,
      now: Date.now,
    }),
    now,
    quotaReserve: QUOTA_RESERVE,
    timeoutMs: REPORT_TIMEOUT_MS,
  }),
  now,
};

// Vite serves the React interface from src/web with hot reload; see vite.config.ts.
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });

const server = createServer((request, response) => {
  if (!isAllowedHost(request.headers.host, config.allowedHosts)) {
    sendJson(response, 403, { error: 'Requests must be addressed to this server by name.' });
    return;
  }
  const url = new URL(request.url ?? '/', `http://${host}`);
  if (url.pathname !== '/api/branches') {
    vite.middlewares(request, response, () => {
      sendJson(response, 404, { error: 'Not found.' });
    });
    return;
  }
  serveApi(request, response, url).catch((error: unknown) => {
    process.stderr.write(`Unexpected error: ${String(error)}\n`);
    sendJson(response, 500, { error: 'Unexpected server error.' });
  });
});

async function serveApi(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Only GET is supported.' });
    return;
  }
  const result = await handleBranchesRequest(url.searchParams, dependencies);
  sendJson(response, result.status, result.body, result.headers);
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

server.on('error', (error: NodeJS.ErrnoException) => {
  fail(
    error.code === 'EADDRINUSE'
      ? `Port ${String(port)} is already in use. Set PORT to use another one.`
      : error.message,
  );
});

server.listen(port, host, () => {
  process.stdout.write(`DevPulse is running at http://${host}:${String(port)}\n`);
});
