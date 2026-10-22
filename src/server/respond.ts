import type { IncomingMessage, ServerResponse } from 'node:http';

import { chooseEncoding, compress, MIN_COMPRESSIBLE_BYTES } from './compress.ts';

/** A request and the response that answers it. */
export interface Exchange {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
}

/** Sends a JSON body, compressed when the client accepts it and it is worth it. */
export function sendJson(
  { request, response }: Exchange,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  const json = Buffer.from(JSON.stringify(body));
  const encoding =
    json.length >= MIN_COMPRESSIBLE_BYTES
      ? chooseEncoding(request.headers['accept-encoding'])
      : null;
  const payload = encoding === null ? json : compress(json, encoding);
  response.writeHead(status, {
    ...headers,
    ...(encoding === null ? {} : { 'content-encoding': encoding }),
    vary: 'accept-encoding',
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(payload.length),
  });
  response.end(payload);
}
