import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { readNotification, shouldStopBilling, stopBilling } from './index.mjs';

/**
 * A Pub/Sub push envelope, as Eventarc sends it in the HTTP request body.
 *
 * @param {unknown} message
 * @returns {{ message: { data: string }, subscription: string }}
 */
function envelope(message) {
  return {
    message: { data: Buffer.from(JSON.stringify(message)).toString('base64') },
    subscription: 'projects/p/subscriptions/eventarc',
  };
}

/** @returns {{ response: { status(code: number): { end(): void } }, statuses: number[] }} */
function recorder() {
  /** @type {number[]} */
  const statuses = [];
  return {
    response: {
      status: (code) => {
        statuses.push(code);
        return { end: () => undefined };
      },
    },
    statuses,
  };
}

/**
 * Replaces `fetch` with canned answers and records every call.
 *
 * @param {readonly Response[]} answers
 * @returns {{ url: string, method: string, body: string | undefined }[]}
 */
function fakeFetch(answers) {
  /** @type {{ url: string, method: string, body: string | undefined }[]} */
  const calls = [];
  const queue = [...answers];
  mock.method(
    globalThis,
    'fetch',
    /** @type {(input: string, init?: RequestInit) => Promise<Response>} */ (
      (input, init) => {
        const body = typeof init?.body === 'string' ? init.body : undefined;
        calls.push({ url: input, method: init?.method ?? 'GET', body });
        const next = queue.shift();
        return next === undefined
          ? Promise.reject(new Error('Unexpected request'))
          : Promise.resolve(next);
      }
    ),
  );
  return calls;
}

/**
 * A fresh metadata server answer for each test: a response body can be read only once.
 *
 * @returns {Response}
 */
function token() {
  return new Response(JSON.stringify({ access_token: 'token' }));
}

describe('budget kill switch', () => {
  beforeEach(() => {
    process.env['PROJECT_ID'] = 'devpulse-test';
    mock.method(console, 'error', () => undefined);
    mock.method(console, 'warn', () => undefined);
    mock.method(process.stdout, 'write', () => true);
  });

  afterEach(() => {
    mock.restoreAll();
    delete process.env['PROJECT_ID'];
  });

  it('stops billing only once the cost reaches the budget', () => {
    assert.equal(shouldStopBilling({ costAmount: 0.99, budgetAmount: 1 }), false);
    assert.equal(shouldStopBilling({ costAmount: 1, budgetAmount: 1 }), true);
    assert.equal(shouldStopBilling({ costAmount: 3.5, budgetAmount: 1 }), true);
  });

  it('reads the amounts from a Pub/Sub push envelope', () => {
    const notification = readNotification(
      envelope({ budgetDisplayName: 'devpulse', costAmount: 0.42, budgetAmount: 1 }),
    );

    assert.deepEqual(notification, { costAmount: 0.42, budgetAmount: 1 });
    assert.throws(() => readNotification(undefined), /no Pub\/Sub message/);
    assert.throws(() => readNotification(envelope({ hello: 'world' })), /not a budget/);
  });

  it('acknowledges a notification below the budget without calling any API', async () => {
    const calls = fakeFetch([]);
    const { response, statuses } = recorder();

    await stopBilling({ body: envelope({ costAmount: 0.01, budgetAmount: 1 }) }, response);

    assert.deepEqual(statuses, [204]);
    assert.equal(calls.length, 0);
  });

  it('acknowledges a malformed request so that it is not retried', async () => {
    const { response, statuses } = recorder();

    await stopBilling({ body: { not: 'a message' } }, response);

    assert.deepEqual(statuses, [204]);
  });

  it('detaches billing once the budget is reached', async () => {
    const calls = fakeFetch([token(), new Response('{}')]);
    const { response, statuses } = recorder();

    await stopBilling({ body: envelope({ costAmount: 1.2, budgetAmount: 1 }) }, response);

    const [metadata, unlink] = calls;
    assert.deepEqual(statuses, [204]);
    assert.match(metadata?.url ?? '', /^http:\/\/metadata\.google\.internal\//);
    assert.deepEqual(unlink, {
      url: 'https://cloudbilling.googleapis.com/v1/projects/devpulse-test/billingInfo',
      method: 'PUT',
      body: '{"billingAccountName":""}',
    });
  });

  it('answers 500 when billing cannot be detached, so that Pub/Sub retries', async () => {
    const calls = fakeFetch([token(), new Response('{}', { status: 403 })]);
    const { response, statuses } = recorder();

    await stopBilling({ body: envelope({ costAmount: 1, budgetAmount: 1 }) }, response);

    assert.deepEqual(statuses, [500]);
    // The failure comes from the unlink itself, not from an earlier step.
    assert.deepEqual(
      calls.map((call) => call.method),
      ['GET', 'PUT'],
    );
  });
});
