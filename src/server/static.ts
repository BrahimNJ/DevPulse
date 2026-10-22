import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import type { UiHandler } from './app.ts';
import { chooseEncoding, compress, MIN_COMPRESSIBLE_BYTES, type Encoding } from './compress.ts';

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

/** Text compresses well; images such as PNG are already compressed. */
const COMPRESSIBLE: ReadonlySet<string> = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.svg',
  '.txt',
]);

/** The build directory, and compressed copies made once per file and encoding. */
interface Site {
  readonly base: string;
  readonly index: Buffer;
  readonly compressed: Map<string, Buffer>;
}

/**
 * Serves the production build of the interface from `root`. A path without an
 * extension that matches no file, such as `/app`, is a page of the single-page
 * application and gets `index.html`. Rejects when the build is missing.
 */
export async function createStaticHandler(root: string): Promise<UiHandler> {
  const base = path.resolve(root);
  const site: Site = {
    base,
    index: await readFile(path.join(base, 'index.html')),
    compressed: new Map(),
  };

  return (request, response, next) => {
    serveFile(request, response, site)
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
  site: Site,
): Promise<boolean> {
  const { base, index } = site;
  const exchange = { request, response, site };
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
    return send(exchange, 'index.html', index);
  }
  // A path such as /../secret must never leave the build directory.
  if (!file.startsWith(base + path.sep)) {
    return false;
  }
  const body = await readRegularFile(file);
  if (body !== null) {
    return send(exchange, path.relative(base, file), body);
  }
  return path.extname(pathname) === '' && send(exchange, 'index.html', index);
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
  { request, response, site }: { request: IncomingMessage; response: ServerResponse; site: Site },
  relativePath: string,
  body: Buffer,
): true {
  const extension = path.extname(relativePath);
  const isAsset = relativePath.split(path.sep)[0] === 'assets';
  const encoding =
    COMPRESSIBLE.has(extension) && body.length >= MIN_COMPRESSIBLE_BYTES
      ? chooseEncoding(request.headers['accept-encoding'])
      : null;
  const payload = encoding === null ? body : compressedCopy(site, relativePath, body, encoding);
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'content-length': payload.length,
    'cache-control': isAsset ? IMMUTABLE : REVALIDATE,
    vary: 'accept-encoding',
    ...(encoding === null ? {} : { 'content-encoding': encoding }),
  });
  response.end(request.method === 'HEAD' ? undefined : payload);
  return true;
}

/** Build files never change while the server runs, so each is compressed once. */
function compressedCopy(
  site: Site,
  relativePath: string,
  body: Buffer,
  encoding: Encoding,
): Buffer {
  const key = `${encoding}:${relativePath}`;
  const cached = site.compressed.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = compress(body, encoding);
  site.compressed.set(key, result);
  return result;
}
