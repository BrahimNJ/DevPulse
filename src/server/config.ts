import { parsePort } from './host.ts';

/** Settings that differ between a developer machine and a deployment (ADR 0007). */
export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** Lower-case `Host` header values the server answers. */
  readonly allowedHosts: ReadonlySet<string>;
  /** Whether a proxy in front appends the client address to `X-Forwarded-For`. */
  readonly trustProxy: boolean;
  readonly rateLimitPerMinute: number;
}

export type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const LOOPBACK: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Reads the configuration from the environment. Every default keeps the local
 * behaviour of ADR 0006, so a deployment must opt in to a public address. Returns an
 * error message when a value is invalid.
 */
export function loadConfig(env: Environment): ServerConfig | string {
  const port = parsePort(env['PORT']);
  if (port === null) {
    return 'PORT must be a whole number between 1 and 65535.';
  }
  const trustProxy = parseBoolean(env['TRUST_PROXY']);
  if (trustProxy === null) {
    return 'TRUST_PROXY must be true or false.';
  }
  const rateLimitPerMinute = parsePositiveInteger(env['RATE_LIMIT_PER_MINUTE']);
  if (rateLimitPerMinute === null) {
    return 'RATE_LIMIT_PER_MINUTE must be a positive whole number.';
  }
  const host = nonEmpty(env['HOST']) ?? DEFAULT_HOST;
  const explicitHosts = parseHosts(env['ALLOWED_HOSTS']);
  // The defaults name the port, which a public Host header such as Cloud Run's lacks:
  // a reachable server without its own names would answer 403 to every visitor.
  if (explicitHosts === undefined && !LOOPBACK.has(host)) {
    return 'ALLOWED_HOSTS must list the public host names when HOST is not a loopback address.';
  }
  const allowedHosts = explicitHosts ?? [`127.0.0.1:${String(port)}`, `localhost:${String(port)}`];

  return {
    host,
    port,
    allowedHosts: new Set(allowedHosts),
    trustProxy,
    rateLimitPerMinute,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/** A comma-separated list of `Host` values, or undefined when none is given. */
function parseHosts(value: string | undefined): string[] | undefined {
  const hosts = (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
  return hosts.length === 0 ? undefined : hosts;
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value === 'false') {
    return false;
  }
  return value === 'true' ? true : null;
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined) {
    return DEFAULT_RATE_LIMIT_PER_MINUTE;
  }
  return /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : null;
}
