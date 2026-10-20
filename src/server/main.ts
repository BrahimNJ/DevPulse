import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createServer as createViteServer } from 'vite';

import { GitHubClient } from '../github/client.ts';
import { handleBranchesRequest, type ApiDependencies } from './api.ts';
import { isAllowedHost, parsePort } from './host.ts';

// Local only: the server holds a GitHub token, so it must not be reachable from the network.
const HOST = '127.0.0.1';
const port = parsePort(process.env['PORT']);
const token = process.env['GITHUB_TOKEN'];

if (port === null) {
  fail('PORT must be a whole number between 1 and 65535.');
}
if (token === undefined || token === '') {
  fail(
    'GITHUB_TOKEN is not set. The GitHub GraphQL API requires a token,\n' +
      'for example: GITHUB_TOKEN=$(gh auth token) npm run web',
  );
}

const dependencies: ApiDependencies = {
  client: new GitHubClient({ token, fetch: globalThis.fetch }),
  now: () => new Date(),
};

// Vite serves the React interface from src/web with hot reload; see vite.config.ts.
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });

const server = createServer((request, response) => {
  if (!isAllowedHost(request.headers.host, port)) {
    sendJson(response, 403, { error: 'Requests must be addressed to 127.0.0.1 or localhost.' });
    return;
  }
  const url = new URL(request.url ?? '/', `http://${HOST}`);
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
  sendJson(response, result.status, result.body);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
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

server.listen(port, HOST, () => {
  process.stdout.write(`DevPulse is running at http://${HOST}:${String(port)}\n`);
});
