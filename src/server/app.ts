import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleBranchesRequest, type ApiDependencies } from './api.ts';
import { clientIp } from './client-ip.ts';
import type { ServerConfig } from './config.ts';
import { isAllowedHost } from './host.ts';
import type { RateLimiter } from './rate-limit.ts';

/** Serves the interface; calls `next` when it has nothing for the request. */
export type UiHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void;

export type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

export type Route = 'api' | 'health' | 'ui' | 'rejected';

/** One structured log line; `severity` and `httpRequest` are read by Cloud Logging. */
export interface RequestLog {
  readonly severity: 'INFO' | 'WARNING' | 'ERROR';
  readonly message: string;
  readonly route: Route;
  readonly httpRequest: {
    readonly requestMethod: string;
    readonly requestUrl: string;
    readonly status: number;
    readonly latency: string;
    readonly userAgent?: string;
  };
  readonly cacheHit?: boolean;
  /** The unexpected failure behind a 500, for debugging. */
  readonly error?: string;
}

export interface AppOptions {
  readonly config: ServerConfig;
  readonly api: ApiDependencies;
  readonly limiter: RateLimiter;
  readonly ui: UiHandler;
  /** Sent with every response. */
  readonly headers: Readonly<Record<string, string>>;
  /** Milliseconds from any origin, such as `performance.now`, to time requests. */
  readonly clock: () => number;
  readonly log: (entry: RequestLog) => void;
}

/** Headers that suit both development and production. */
export const BASE_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
};

/**
 * Production adds a strict content security policy, which the built interface allows
 * because it has no inline script or style. Vite's development client would break it.
 */
export const PRODUCTION_HEADERS: Readonly<Record<string, string>> = {
  ...BASE_HEADERS,
  'content-security-policy':
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; " +
    "form-action 'self'; frame-ancestors 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'strict-transport-security': 'max-age=31536000',
};

interface Context {
  route: Route;
  cacheHit?: boolean;
  error?: string;
}

export function createApp(options: AppOptions): RequestHandler {
  return (request, response) => {
    const started = options.clock();
    const context: Context = { route: 'rejected' };
    response.on('finish', () => {
      options.log(requestLog(request, response.statusCode, options.clock() - started, context));
    });
    for (const [name, value] of Object.entries(options.headers)) {
      response.setHeader(name, value);
    }
    route(request, response, options, context).catch((error: unknown) => {
      context.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
      sendJson(response, 500, { error: 'Unexpected server error.' });
    });
  };
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  options: AppOptions,
  context: Context,
): Promise<void> {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  // Health reveals nothing, so probes may use any Host, such as the instance address.
  if (pathname === '/healthz') {
    context.route = 'health';
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (!isAllowedHost(request.headers.host, options.config.allowedHosts)) {
    sendJson(response, 403, { error: 'Requests must be addressed to this server by name.' });
    return;
  }
  if (pathname === '/api/branches') {
    context.route = 'api';
    await serveApi(request, response, options, context);
    return;
  }
  if (pathname.startsWith('/api/')) {
    context.route = 'api';
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  context.route = 'ui';
  options.ui(request, response, () => {
    sendJson(response, 404, { error: 'Not found.' });
  });
}

async function serveApi(
  request: IncomingMessage,
  response: ServerResponse,
  { api, config, limiter }: AppOptions,
  context: Context,
): Promise<void> {
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Only GET is supported.' }, { allow: 'GET' });
    return;
  }
  const client = clientIp(
    request.headers['x-forwarded-for'],
    request.socket.remoteAddress,
    config.trustProxy,
  );
  const decision = limiter.take(client);
  if (!decision.allowed) {
    const seconds = String(decision.retryAfterSeconds);
    sendJson(
      response,
      429,
      { error: `Too many requests. Try again in ${seconds} seconds.` },
      { 'retry-after': seconds },
    );
    return;
  }
  const { searchParams } = new URL(request.url ?? '/', 'http://localhost');
  const result = await handleBranchesRequest(searchParams, api);
  if (result.cacheHit !== undefined) {
    context.cacheHit = result.cacheHit;
  }
  sendJson(response, result.status, result.body, {
    ...result.headers,
    'cache-control': 'no-store',
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, { ...headers, 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

/** The client address is left out on purpose: it is personal data and not needed. */
function requestLog(
  request: IncomingMessage,
  status: number,
  durationMs: number,
  context: Context,
): RequestLog {
  const method = request.method ?? 'GET';
  const url = request.url ?? '/';
  const userAgent = request.headers['user-agent'];
  return {
    severity: severityOf(status),
    message: `${method} ${url} ${String(status)}`,
    route: context.route,
    httpRequest: {
      requestMethod: method,
      requestUrl: url,
      status,
      latency: `${(durationMs / 1000).toFixed(3)}s`,
      ...(userAgent === undefined ? {} : { userAgent }),
    },
    ...(context.cacheHit === undefined ? {} : { cacheHit: context.cacheHit }),
    ...(context.error === undefined ? {} : { error: context.error }),
  };
}

function severityOf(status: number): RequestLog['severity'] {
  if (status >= 500) {
    return 'ERROR';
  }
  return status >= 400 ? 'WARNING' : 'INFO';
}
