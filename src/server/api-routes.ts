import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  handleBranchesRequest,
  handleDeliveryRequest,
  handleQuotaRequest,
  type Visitor,
} from './api.ts';
import type { AppOptions, Context } from './app.ts';
import { sendJson } from './respond.ts';

/** Everything an API route needs about the request being served. */
export interface ApiCall {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly options: AppOptions;
  readonly context: Context;
  readonly visitor: Visitor;
  /** The client address, for rate limiting. */
  readonly client: string;
}

type ApiRoute = (call: ApiCall) => Promise<void>;

/** A JSON body larger than this is not an owner key. */
const MAX_BODY_BYTES = 1024;

const NO_STORE = { 'cache-control': 'no-store' };

export const API_ROUTES: ReadonlyMap<string, ApiRoute> = new Map([
  ['/api/branches', branches],
  ['/api/delivery', delivery],
  ['/api/quota', quota],
  ['/api/owner', owner],
]);

async function branches(call: ApiCall): Promise<void> {
  const { request, response, options, context, visitor } = call;
  if (!allowMethods(call, ['GET']) || !withinRateLimit(call)) {
    return;
  }
  const { searchParams } = new URL(request.url ?? '/', 'http://localhost');
  const result = await handleBranchesRequest(searchParams, options.api, visitor);
  if (result.cacheHit !== undefined) {
    context.cacheHit = result.cacheHit;
  }
  sendJson({ request, response }, result.status, result.body, { ...result.headers, ...NO_STORE });
}

async function delivery(call: ApiCall): Promise<void> {
  const { request, response, options, context, visitor } = call;
  if (!allowMethods(call, ['GET']) || !withinRateLimit(call)) {
    return;
  }
  const { searchParams } = new URL(request.url ?? '/', 'http://localhost');
  const result = await handleDeliveryRequest(searchParams, options.api, visitor);
  if (result.cacheHit !== undefined) {
    context.cacheHit = result.cacheHit;
  }
  sendJson({ request, response }, result.status, result.body, { ...result.headers, ...NO_STORE });
}

async function quota(call: ApiCall): Promise<void> {
  if (!allowMethods(call, ['GET']) || !withinRateLimit(call)) {
    return;
  }
  const body = await handleQuotaRequest(call.options.api, call.visitor);
  sendJson(call, 200, body, NO_STORE);
}

/**
 * Maintainer sign-in (ADR 0008): `POST` with `{ "key": "…" }` sets the owner cookie,
 * `DELETE` removes it. Attempts are limited per client, and a cross-site form cannot
 * post here: the Origin must be this site, and the cookie is SameSite=Strict.
 */
async function owner(call: ApiCall): Promise<void> {
  const { request, response, options } = call;
  const access = options.visitors.owner;
  if (access === null) {
    sendJson({ request, response }, 404, { error: 'Not found.' }, NO_STORE);
    return;
  }
  if (!allowMethods(call, ['POST', 'DELETE'])) {
    return;
  }
  if (!sameOrigin(request.headers.origin, options.config.allowedHosts)) {
    sendJson({ request, response }, 403, { error: 'Cross-site requests are refused.' }, NO_STORE);
    return;
  }
  if (request.method === 'DELETE') {
    sendJson(
      { request, response },
      200,
      { owner: false },
      {
        ...NO_STORE,
        'set-cookie': access.clearCookie(),
      },
    );
    return;
  }
  const decision = options.ownerLimiter.take(call.client);
  if (!decision.allowed) {
    tooManyRequests(call, decision.retryAfterSeconds);
    return;
  }
  if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    sendJson(call, 413, { error: 'The request body is too large.' }, NO_STORE);
    return;
  }
  const key = await readKey(request);
  if (key === null || !access.verifyKey(key)) {
    sendJson({ request, response }, 401, { error: 'This key is not valid.' }, NO_STORE);
    return;
  }
  sendJson(
    { request, response },
    200,
    { owner: true },
    {
      ...NO_STORE,
      'set-cookie': access.issueCookie(options.api.now()),
    },
  );
}

function allowMethods(call: ApiCall, methods: readonly string[]): boolean {
  if (methods.includes(call.request.method ?? 'GET')) {
    return true;
  }
  sendJson(
    call,
    405,
    { error: `Only ${methods.join(' and ')} are supported.` },
    { allow: methods.join(', ') },
  );
  return false;
}

function withinRateLimit(call: ApiCall): boolean {
  const decision = call.options.limiter.take(call.client);
  if (!decision.allowed) {
    tooManyRequests(call, decision.retryAfterSeconds);
  }
  return decision.allowed;
}

function tooManyRequests(call: ApiCall, retryAfterSeconds: number): void {
  const seconds = String(retryAfterSeconds);
  sendJson(
    call,
    429,
    { error: `Too many requests. Try again in ${seconds} seconds.` },
    { 'retry-after': seconds, ...NO_STORE },
  );
}

/** Browsers always send Origin on a POST; tools such as curl may omit it. */
function sameOrigin(origin: string | undefined, allowedHosts: ReadonlySet<string>): boolean {
  if (origin === undefined) {
    return true;
  }
  try {
    return allowedHosts.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

async function readKey(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      return null;
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { key?: unknown };
    return typeof body.key === 'string' ? body.key : null;
  } catch {
    return null;
  }
}
