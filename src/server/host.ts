export const DEFAULT_PORT = 5173;

/**
 * Accepts only requests addressed to this server by one of its own names. Binding to
 * 127.0.0.1 is not enough on its own: a malicious page can rebind its domain to
 * 127.0.0.1 (DNS rebinding) and then call the API, and the GitHub token, from the
 * browser. Such requests carry the attacker's domain in `Host`, so they are rejected
 * here. A deployed server lists its public names instead (ADR 0007).
 */
export function isAllowedHost(
  host: string | undefined,
  allowedHosts: ReadonlySet<string>,
): boolean {
  return host !== undefined && allowedHosts.has(host.toLowerCase());
}

/** Parses the `PORT` environment variable, or returns null when it is not a valid port. */
export function parsePort(value: string | undefined): number | null {
  if (value === undefined) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  return /^\d+$/.test(value) && port >= 1 && port <= 65_535 ? port : null;
}
