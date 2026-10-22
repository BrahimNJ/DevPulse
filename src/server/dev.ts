import { createServer as createViteServer } from 'vite';

import { BASE_HEADERS } from './app.ts';
import { serve } from './serve.ts';

// Development: Vite serves src/web with hot reload; see vite.config.ts.
await serve({
  example: 'GITHUB_TOKEN=$(gh auth token) npm run web',
  createUi: async () => {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    return (request, response, next): void => {
      vite.middlewares(request, response, next);
    };
  },
  headers: BASE_HEADERS,
  // Vite loads dozens of modules per page; only API calls and failures are worth a line.
  log: (entry) => {
    if (entry.route !== 'ui' || entry.severity !== 'INFO') {
      process.stdout.write(`${entry.message}${entry.cacheHit === true ? ' (cached)' : ''}\n`);
      if (entry.error !== undefined) {
        process.stderr.write(`${entry.error}\n`);
      }
    }
  },
  announce: (url) => {
    process.stdout.write(`DevPulse is running at ${url}\n`);
  },
});
