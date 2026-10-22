import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { encodedMessage, readNotification, shouldStopBilling, stopBilling } from './index.mjs';

/**
 * @param {unknown} notification
 * @returns {string}
 */
function encode(notification) {
  return Buffer.from(JSON.stringify(notification)).toString('base64');
}

/**
 * The three ways the platform can pass a Pub/Sub message to the function. The legacy
 * event shape is the one observed on the deployed function.
 */
const SHAPES = {
  /** @param {unknown} notification */
  legacyEvent: (notification) => ({ data: encode(notification), attributes: {} }),
  /** @param {unknown} notification */
  cloudEvent: (notification) => ({ data: { message: { data: encode(notification) } } }),
  /** @param {unknown} notification */
  httpRequest: (notification) => ({ body: { message: { data: encode(notification) } } }),
};

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

const UNLINK = {
  url: 'https://cloudbilling.googleapis.com/v1/projects/devpulse-test/billingInfo',
  method: 'PUT',
  body: '{"billingAccountName":""}',
};

describe('budget kill switch', () => {
  /** Counts the errors the function logs. */
  let errors = { mock: { callCount: () => 0 } };

  beforeEach(() => {
    process.env['PROJECT_ID'] = 'devpulse-test';
    errors = mock.method(console, 'error', () => undefined);
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

  it('declares one parameter, so the framework never waits for a callback', () => {
    assert.equal(stopBilling.length, 1);
  });

  it('finds the message in every call shape', () => {
    const notification = { costAmount: 0.42, budgetAmount: 1 };
    for (const [name, shape] of Object.entries(SHAPES)) {
      assert.deepEqual(readNotification(encodedMessage(shape(notification))), notification, name);
    }
    assert.equal(encodedMessage(undefined), undefined);
    assert.equal(encodedMessage({ body: { not: 'a message' } }), undefined);
    assert.throws(() => readNotification(encodedMessage({})), /no Pub\/Sub message/);
    assert.throws(() => readNotification(encode({ hello: 'world' })), /not a budget/);
  });

  it('acknowledges a notification below the budget without calling any API', async () => {
    const calls = fakeFetch([]);

    for (const shape of Object.values(SHAPES)) {
      await stopBilling(shape({ costAmount: 0.01, budgetAmount: 1 }), { eventId: '1' });
    }

    assert.equal(calls.length, 0);
  });

  it('acknowledges a message that was delivered but cannot be read', async () => {
    const { response, statuses } = recorder();

    await stopBilling({ data: 'not base64 JSON' }, { eventId: '1' });
    await stopBilling(SHAPES.httpRequest({ hello: 'world' }), response);

    assert.deepEqual(statuses, [204]);
    assert.equal(errors.mock.callCount(), 2);
  });

  it('fails closed on a call shape it does not recognise, so that Pub/Sub retries', async () => {
    const { response, statuses } = recorder();

    await assert.rejects(stopBilling({ unknown: 'shape' }, { eventId: '1' }), /not recognised/);
    await stopBilling({ body: { not: 'a message' } }, response);

    assert.deepEqual(statuses, [500]);
  });

  it('detaches billing once the budget is reached, as observed in production', async () => {
    const calls = fakeFetch([token(), new Response('{}')]);

    await stopBilling(SHAPES.legacyEvent({ costAmount: 1.2, budgetAmount: 1 }), {
      eventId: '1',
    });

    const [metadata, unlink] = calls;
    assert.match(metadata?.url ?? '', /^http:\/\/metadata\.google\.internal\//);
    assert.deepEqual(unlink, UNLINK);
  });

  it('throws for the event signatures when billing cannot be detached', async () => {
    const calls = fakeFetch([token(), new Response('{}', { status: 403 })]);

    await assert.rejects(
      stopBilling(SHAPES.cloudEvent({ costAmount: 1, budgetAmount: 1 })),
      /failed with 403/,
    );
    // The failure comes from the unlink itself, not from an earlier step.
    assert.deepEqual(
      calls.map((call) => call.method),
      ['GET', 'PUT'],
    );
  });

  it('answers 204 or 500 for the HTTP signature', async () => {
    fakeFetch([token(), new Response('{}'), token(), new Response('{}', { status: 403 })]);
    const { response, statuses } = recorder();

    await stopBilling(SHAPES.httpRequest({ costAmount: 1, budgetAmount: 1 }), response);
    await stopBilling(SHAPES.httpRequest({ costAmount: 1, budgetAmount: 1 }), response);

    assert.deepEqual(statuses, [204, 500]);
  });
});
