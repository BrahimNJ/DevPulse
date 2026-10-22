import { createHmac } from 'node:crypto';
import { isIPv6 } from 'node:net';

/**
 * A stable, non-reversible identifier of a visitor (ADR 0008): an HMAC of the client
 * address with a secret salt, so the raw address is never stored and cannot be
 * recovered by hashing every possible address. An IPv6 subscriber usually holds a
 * whole /64, so only those first 64 bits identify the visitor.
 */
export function visitorId(address: string, salt: string): string {
  return createHmac('sha256', salt).update(networkOf(address)).digest('hex');
}

function networkOf(address: string): string {
  // An IPv4 client seen through an IPv6 socket, such as ::ffff:203.0.113.7.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped !== undefined) {
    return mapped;
  }
  if (!isIPv6(address)) {
    return address;
  }
  return expandIPv6(address).slice(0, 4).join(':');
}

/** The eight groups of an IPv6 address, with `::` expanded and leading zeros removed. */
function expandIPv6(address: string): string[] {
  const [head = '', tail] = address.toLowerCase().split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((group) =>
    Number.parseInt(group, 16).toString(16),
  );
}
