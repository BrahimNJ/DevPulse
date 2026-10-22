import { createServer, request as httpRequest, type OutgoingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { RequestHandler } from './app.ts';

export interface TestResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}

export type Send = (
  path: string,
  options?: { readonly method?: string; readonly headers?: OutgoingHttpHeaders },
) => Promise<TestResponse>;

/**
 * Runs `handler` on an ephemeral loopback port for one test. `node:http` is used rather
 * than `fetch`, which forbids setting the `Host` header that the server checks.
 */
export async function withServer(
  handler: RequestHandler,
  test: (send: Send) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const send: Send = (path, options = {}) =>
    new Promise((resolve, reject) => {
      const outgoing = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path,
          method: options.method ?? 'GET',
          headers: { host: 'devpulse.test', ...options.headers },
        },
        (incoming) => {
          let body = '';
          incoming.setEncoding('utf8');
          incoming.on('data', (chunk: string) => (body += chunk));
          incoming.on('end', () => {
            resolve({ status: incoming.statusCode ?? 0, headers: incoming.headers, body });
          });
        },
      );
      outgoing.on('error', reject);
      outgoing.end();
    });
  try {
    await test(send);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
