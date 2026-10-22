/**
 * Identifies the client for rate limiting. Behind a trusted proxy, the address is the
 * last `X-Forwarded-For` entry, which the proxy appends: earlier entries come from the
 * client and can be forged to dodge the limit. The rule holds only while clients reach
 * that proxy directly (ADR 0007). Without a proxy, the socket address is the client.
 */
export function clientIp(
  forwardedFor: string | string[] | undefined,
  socketAddress: string | undefined,
  trustProxy: boolean,
): string {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const last = header?.split(',').at(-1)?.trim();
  if (trustProxy && last !== undefined && last !== '') {
    return last;
  }
  return socketAddress ?? 'unknown';
}
