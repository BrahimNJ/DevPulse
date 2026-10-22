import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import type { UiHandler } from './app.ts';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Vite names build assets after their content, so a cached copy is never stale. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
/** Everything else, `index.html` above all, is revalidated so a release shows at once. */
const REVALIDATE = 'no-cache';

/**
 * Serves the production build of the interface from `root`. A path without an
 * extension that matches no file, such as `/app`, is a page of the single-page
 * application and gets `index.html`. Rejects when the build is missing.
 */
export async function createStaticHandler(root: string): Promise<UiHandler> {
  const base = path.resolve(root);
  const index = await readFile(path.join(base, 'index.html'));

  return (request, response, next) => {
    serveFile(request, response, base, index)
      .then((served) => {
        if (!served) {
          next();
        }
      })
      .catch(next);
  };
}

async function serveFile(
  request: IncomingMessage,
  response: ServerResponse,
  base: string,
  index: Buffer,
): Promise<boolean> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return true;
  }
  const pathname = decodePathname(request.url);
  if (pathname === null) {
    return false;
  }
  const file = path.resolve(base, `.${pathname}`);
  if (file === base) {
    return send(request, response, 'index.html', index);
  }
  // A path such as /../secret must never leave the build directory.
  if (!file.startsWith(base + path.sep)) {
    return false;
  }
  const body = await readRegularFile(file);
  if (body !== null) {
    return send(request, response, path.relative(base, file), body);
  }
  return path.extname(pathname) === '' && send(request, response, 'index.html', index);
}

function decodePathname(url: string | undefined): string | null {
  try {
    return decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname);
  } catch {
    return null;
  }
}

async function readRegularFile(file: string): Promise<Buffer | null> {
  try {
    return (await stat(file)).isFile() ? await readFile(file) : null;
  } catch {
    return null;
  }
}

function send(
  request: IncomingMessage,
  response: ServerResponse,
  relativePath: string,
  body: Buffer,
): true {
  const isAsset = relativePath.split(path.sep)[0] === 'assets';
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(relativePath)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': isAsset ? IMMUTABLE : REVALIDATE,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
  return true;
}
