import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { createServer as createViteServer } from 'vite';

import { GitHubClient } from '../github/client.ts';
import { handleBranchesRequest, type ApiDependencies } from './api.ts';

// Local only: the server holds a GitHub token, so it must not be reachable from the network.
const HOST = '127.0.0.1';
const port = Number(process.env['PORT'] ?? '5173');
const token = process.env['GITHUB_TOKEN'];

if (token === undefined || token === '') {
  process.stderr.write(
    'Error: GITHUB_TOKEN is not set. The GitHub GraphQL API requires a token,\n' +
      'for example: GITHUB_TOKEN=$(gh auth token) npm run web\n',
  );
  process.exit(1);
}

const dependencies: ApiDependencies = {
  client: new GitHubClient({ token, fetch: globalThis.fetch }),
  now: () => new Date(),
};

// Vite serves the React interface from src/web with hot reload; see vite.config.ts.
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}`);
  if (url.pathname !== '/api/branches') {
    vite.middlewares(request, response);
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
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

server.listen(port, HOST, () => {
  process.stdout.write(`DevPulse is running at http://${HOST}:${String(port)}\n`);
});
