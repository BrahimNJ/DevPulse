import { fileURLToPath } from 'node:url';

import { PRODUCTION_HEADERS } from './app.ts';
import { fail, serve } from './serve.ts';
import { createStaticHandler } from './static.ts';

// Production: serves the output of `npm run build` and never imports Vite, a
// development dependency that the production image does not contain (ADR 0007).
const BUILD_DIRECTORY = fileURLToPath(new URL('../../dist/web', import.meta.url));

await serve({
  example: 'GITHUB_TOKEN=$(gh auth token) npm start',
  createUi: () =>
    createStaticHandler(BUILD_DIRECTORY).catch(() =>
      fail(`No interface build in ${BUILD_DIRECTORY}. Run npm run build first.`),
    ),
  headers: PRODUCTION_HEADERS,
  // One JSON object per line on stdout, which Cloud Logging parses into fields.
  log: (entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  },
  announce: (url) => {
    process.stdout.write(
      `${JSON.stringify({ severity: 'INFO', message: `DevPulse is running at ${url}` })}\n`,
    );
  },
});
