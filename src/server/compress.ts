import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export type Encoding = 'br' | 'gzip';

/** Below this size, compression costs more time than it saves on the wire. */
export const MIN_COMPRESSIBLE_BYTES = 1024;

/** The best encoding the client accepts, preferring Brotli, which is smaller. */
export function chooseEncoding(acceptEncoding: string | undefined): Encoding | null {
  const accepted = new Set(
    (acceptEncoding ?? '')
      .split(',')
      .filter((part) => !/;\s*q=0(\.0*)?\s*$/.test(part))
      .map((part) => part.split(';')[0]?.trim().toLowerCase()),
  );
  if (accepted.has('br')) {
    return 'br';
  }
  return accepted.has('gzip') ? 'gzip' : null;
}

/**
 * Compresses a response body. Brotli runs at a middle quality: the static files are
 * compressed once and cached, and API responses must stay fast to produce.
 */
export function compress(body: Buffer, encoding: Encoding): Buffer {
  return encoding === 'br'
    ? brotliCompressSync(body, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 6,
          [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
        },
      })
    : gzipSync(body, { level: 6 });
}
