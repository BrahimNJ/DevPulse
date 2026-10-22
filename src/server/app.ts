import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ApiDependencies, Visitor } from './api.ts';
import { API_ROUTES } from './api-routes.ts';
import { clientIp } from './client-ip.ts';
import type { ServerConfig } from './config.ts';
import { isAllowedHost } from './host.ts';
import type { OwnerAccess } from './owner.ts';
import type { RateLimiter } from './rate-limit.ts';
import { sendJson } from './respond.ts';
import { visitorId } from './visitor.ts';

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
  /** Stricter limit on owner sign-in attempts, against guessing the key. */
  readonly ownerLimiter: RateLimiter;
  readonly visitors: {
    /** Salt of the visitor identifiers (ADR 0008). */
    readonly salt: string;
    /** Maintainer access; null when no owner key is configured. */
    readonly owner: OwnerAccess | null;
  };
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

/** The conventional status for a request that the client abandoned before the answer. */
const CLIENT_CLOSED = 499;

export interface Context {
  route: Route;
  cacheHit?: boolean;
  error?: string;
}

export function createApp(options: AppOptions): RequestHandler {
  return (request, response) => {
    const started = options.clock();
    const context: Context = { route: 'rejected' };
    // `close` also fires when the client gives up first, so slow requests are logged too.
    response.on('close', () => {
      const status = response.writableFinished ? response.statusCode : CLIENT_CLOSED;
      options.log(requestLog(request, status, options.clock() - started, context));
    });
    for (const [name, value] of Object.entries(options.headers)) {
      response.setHeader(name, value);
    }
    route(request, response, options, context).catch((error: unknown) => {
      context.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
      sendJson({ request, response }, 500, { error: 'Unexpected server error.' });
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
  if (pathname === '/health') {
    context.route = 'health';
    sendJson({ request, response }, 200, { status: 'ok' });
    return;
  }
  if (!isAllowedHost(request.headers.host, options.config.allowedHosts)) {
    sendJson({ request, response }, 403, {
      error: 'Requests must be addressed to this server by name.',
    });
    return;
  }
  if (!pathname.startsWith('/api/')) {
    context.route = 'ui';
    options.ui(request, response, () => {
      sendJson({ request, response }, 404, { error: 'Not found.' });
    });
    return;
  }
  context.route = 'api';
  const api = API_ROUTES.get(pathname);
  if (api === undefined) {
    sendJson({ request, response }, 404, { error: 'Not found.' });
    return;
  }
  const client = clientIp(
    request.headers['x-forwarded-for'],
    request.socket.remoteAddress,
    options.config.trustProxy,
  );
  await api({
    request,
    response,
    options,
    context,
    client,
    visitor: identify(request, client, options),
  });
}

function identify(request: IncomingMessage, client: string, options: AppOptions): Visitor {
  const { salt, owner } = options.visitors;
  return {
    id: visitorId(client, salt),
    owner: owner?.isOwner(request.headers.cookie, options.api.now()) ?? false,
  };
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
