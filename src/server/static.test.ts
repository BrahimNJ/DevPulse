import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import type { RequestHandler } from './app.ts';
import { withServer } from './http-test.ts';
import { createStaticHandler } from './static.ts';

describe('createStaticHandler', () => {
  let root = '';
  let handler: RequestHandler = () => undefined;

  before(async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'devpulse-static-'));
    root = path.join(parent, 'web');
    await mkdir(path.join(root, 'assets'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), '<p>index</p>');
    await writeFile(path.join(root, 'assets', 'index-abc123.js'), 'console.log(1);');
    await writeFile(path.join(root, 'favicon.svg'), '<svg/>');
    await writeFile(path.join(parent, 'secret.txt'), 'secret');
    const serveUi = await createStaticHandler(root);
    handler = (request, response): void => {
      serveUi(request, response, () => {
        response.writeHead(404);
        response.end();
      });
    };
  });

  after(async () => {
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  it('serves hashed assets as immutable and other files with revalidation', async () => {
    await withServer(handler, async (send) => {
      const asset = await send('/assets/index-abc123.js');
      const icon = await send('/favicon.svg');

      assert.equal(asset.body, 'console.log(1);');
      assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');
      assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
      assert.equal(icon.headers['content-type'], 'image/svg+xml');
      assert.equal(icon.headers['cache-control'], 'no-cache');
    });
  });

  it('answers pages of the application with index.html', async () => {
    await withServer(handler, async (send) => {
      for (const page of ['/', '/app', '/app?repo=acme/app']) {
        const response = await send(page);
        assert.equal(response.body, '<p>index</p>', page);
        assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
      }
    });
  });

  it('never serves a file outside the build directory', async () => {
    await withServer(handler, async (send) => {
      for (const attempt of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
        const response = await send(attempt);
        assert.equal(response.status, 404, attempt);
        assert.notEqual(response.body, 'secret', attempt);
      }
    });
  });

  it('answers 404 for a missing file, HEAD without a body, and 405 for writes', async () => {
    await withServer(handler, async (send) => {
      const head = await send('/favicon.svg', { method: 'HEAD' });

      assert.equal((await send('/missing.js')).status, 404);
      assert.equal(head.status, 200);
      assert.equal(head.body, '');
      assert.equal(head.headers['content-length'], '6');
      assert.equal((await send('/', { method: 'POST' })).status, 405);
    });
  });

  it('refuses to start without a build', async () => {
    await assert.rejects(createStaticHandler(path.join(root, 'missing')));
  });
});
