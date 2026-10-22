import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const OWNER_COOKIE = 'devpulse_owner';

export interface OwnerAccessOptions {
  /** The secret the maintainer types once; it also signs the cookie (ADR 0008). */
  readonly key: string;
  /** Mark the cookie Secure, which a browser only returns over HTTPS. */
  readonly secure: boolean;
  readonly maxAgeMs: number;
}

/**
 * Unlimited access for the maintainer. Submitting the key sets a cookie holding an
 * expiry and an HMAC of it: the key itself never leaves the server again, the cookie
 * cannot be forged or extended without the key, and rotating the key revokes every
 * cookie at once.
 */
export class OwnerAccess {
  readonly #options: OwnerAccessOptions;

  constructor(options: OwnerAccessOptions) {
    this.#options = options;
  }

  /** Constant-time comparison: the time taken reveals nothing about the key. */
  verifyKey(candidate: string): boolean {
    return equalDigests(sha256(candidate), sha256(this.#options.key));
  }

  /** A `Set-Cookie` value that grants owner access until it expires. */
  issueCookie(now: Date): string {
    const expires = now.getTime() + this.#options.maxAgeMs;
    const value = `${String(expires)}.${this.#sign(expires)}`;
    return this.#cookie(value, Math.floor(this.#options.maxAgeMs / 1000));
  }

  /** A `Set-Cookie` value that removes the cookie. */
  clearCookie(): string {
    return this.#cookie('', 0);
  }

  isOwner(cookieHeader: string | undefined, now: Date): boolean {
    const value = readCookie(cookieHeader, OWNER_COOKIE);
    const [expiresText, signature] = value?.split('.') ?? [];
    const expires = Number(expiresText);
    if (signature === undefined || !Number.isSafeInteger(expires) || expires <= now.getTime()) {
      return false;
    }
    return equalDigests(Buffer.from(signature, 'hex'), Buffer.from(this.#sign(expires), 'hex'));
  }

  #sign(expires: number): string {
    return createHmac('sha256', this.#options.key)
      .update(`owner:${String(expires)}`)
      .digest('hex');
  }

  #cookie(value: string, maxAgeSeconds: number): string {
    const attributes = [
      `${OWNER_COOKIE}=${value}`,
      'Path=/',
      `Max-Age=${String(maxAgeSeconds)}`,
      'HttpOnly',
      'SameSite=Strict',
    ];
    if (this.#options.secure) {
      attributes.push('Secure');
    }
    return attributes.join('; ');
  }
}

function sha256(text: string): Buffer {
  return createHash('sha256').update(text).digest();
}

function equalDigests(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return undefined;
}
