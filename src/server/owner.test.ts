import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { chooseEncoding, compress } from './compress.ts';
import { OwnerAccess } from './owner.ts';

const NOW = new Date('2026-10-22T12:00:00Z');
const DAY = 86_400_000;

function owner(key = 'a-long-and-random-owner-key', secure = true): OwnerAccess {
  return new OwnerAccess({ key, secure, maxAgeMs: 30 * DAY });
}

/** The `name=value` part of a `Set-Cookie` header, as a browser would send it back. */
function cookieOf(setCookie: string): string {
  return setCookie.split(';')[0] ?? '';
}

describe('OwnerAccess', () => {
  it('accepts only the exact key', () => {
    assert.equal(owner().verifyKey('a-long-and-random-owner-key'), true);
    assert.equal(owner().verifyKey('a-long-and-random-owner-ke'), false);
    assert.equal(owner().verifyKey(''), false);
  });

  it('issues a hardened cookie that grants access until it expires', () => {
    const setCookie = owner().issueCookie(NOW);

    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /Max-Age=2592000/);
    assert.equal(owner().isOwner(`theme=dark; ${cookieOf(setCookie)}`, NOW), true);
    assert.equal(owner().isOwner(cookieOf(setCookie), new Date(NOW.getTime() + 31 * DAY)), false);
  });

  it('rejects a forged, extended or revoked cookie', () => {
    const value = cookieOf(owner().issueCookie(NOW)).split('=')[1] ?? '';
    const [expires, signature] = value.split('.');
    const extended = `devpulse_owner=${String(Number(expires) + DAY)}.${signature ?? ''}`;

    assert.equal(owner().isOwner('devpulse_owner=1999999999999.abcdef', NOW), false);
    assert.equal(owner().isOwner(extended, NOW), false);
    assert.equal(owner('a-rotated-owner-key-value').isOwner(`devpulse_owner=${value}`, NOW), false);
    assert.equal(owner().isOwner(undefined, NOW), false);
  });

  it('omits Secure over plain HTTP and clears the cookie on sign-out', () => {
    assert.doesNotMatch(owner(undefined, false).issueCookie(NOW), /Secure/);
    assert.match(owner().clearCookie(), /^devpulse_owner=; Path=\/; Max-Age=0/);
  });
});

describe('compression', () => {
  it('prefers Brotli, then gzip, and honours a refusal', () => {
    assert.equal(chooseEncoding('gzip, deflate, br'), 'br');
    assert.equal(chooseEncoding('gzip'), 'gzip');
    assert.equal(chooseEncoding('br;q=0, gzip'), 'gzip');
    assert.equal(chooseEncoding(undefined), null);
    assert.equal(chooseEncoding('identity'), null);
  });

  it('round-trips a body in both encodings', () => {
    const body = Buffer.from('{"branches":[]}'.repeat(200));

    assert.ok(compress(body, 'br').length < body.length / 10);
    assert.deepEqual(brotliDecompressSync(compress(body, 'br')), body);
    assert.deepEqual(gunzipSync(compress(body, 'gzip')), body);
  });
});
