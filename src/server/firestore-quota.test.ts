import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FirestoreQuotaStore } from './firestore-quota.ts';
import { metadataAccessToken } from './google-auth.ts';
import { visitorId } from './visitor.ts';

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

function fake(responses: readonly Response[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...responses];
  const replay: typeof fetch = (input, init) => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error('Unexpected request'))
      : Promise.resolve(next);
  };
  return { fetch: replay, calls };
}

function store(fetchImpl: typeof fetch): FirestoreQuotaStore {
  return new FirestoreQuotaStore({
    project: 'devpulse-test',
    accessToken: () => Promise.resolve('token'),
    fetch: fetchImpl,
  });
}

const DOCUMENTS =
  'https://firestore.googleapis.com/v1/projects/devpulse-test/databases/(default)/documents/visitors';

describe('FirestoreQuotaStore', () => {
  it('reads a visitor record with its update time as version', async () => {
    const { fetch } = fake([
      Response.json({
        fields: {
          repositories: { arrayValue: { values: [{ stringValue: 'a/one' }] } },
          windowStart: { timestampValue: '2026-10-22T10:00:00Z' },
        },
        updateTime: '2026-10-22T10:00:00.123456Z',
      }),
    ]);

    assert.deepEqual(await store(fetch).get('abc'), {
      record: { repositories: ['a/one'], windowStart: new Date('2026-10-22T10:00:00Z') },
      version: '2026-10-22T10:00:00.123456Z',
    });
  });

  it('reads a missing visitor as null', async () => {
    const { fetch } = fake([new Response('{}', { status: 404 })]);

    assert.equal(await store(fetch).get('abc'), null);
  });

  it('writes with a precondition, and reports a lost race as false', async () => {
    const { fetch, calls } = fake([
      Response.json({ updateTime: 't2' }),
      Response.json({ error: { status: 'FAILED_PRECONDITION' } }, { status: 400 }),
      Response.json({ error: { status: 'ALREADY_EXISTS' } }, { status: 409 }),
    ]);
    const record = { repositories: ['a/one'], windowStart: new Date('2026-10-22T10:00:00Z') };
    const expireAt = new Date('2026-10-23T10:00:00Z');

    assert.equal(await store(fetch).put('abc', record, 't1', expireAt), true);
    assert.equal(await store(fetch).put('abc', record, 't1', expireAt), false);
    assert.equal(await store(fetch).put('abc', record, null, expireAt), false);

    const [first, , third] = calls;
    assert.ok(first);
    assert.equal(first.url, `${DOCUMENTS}/abc?currentDocument.updateTime=t1`);
    assert.equal(first.method, 'PATCH');
    assert.deepEqual(first.body, {
      fields: {
        repositories: { arrayValue: { values: [{ stringValue: 'a/one' }] } },
        windowStart: { timestampValue: '2026-10-22T10:00:00.000Z' },
        expireAt: { timestampValue: '2026-10-23T10:00:00.000Z' },
      },
    });
    assert.equal(third?.url, `${DOCUMENTS}/abc?currentDocument.exists=false`);
  });

  it('fails loudly on any other Firestore error', async () => {
    const { fetch } = fake([
      Response.json({ error: { status: 'PERMISSION_DENIED' } }, { status: 403 }),
    ]);

    await assert.rejects(store(fetch).get('abc'), /PERMISSION_DENIED/);
  });
});

describe('metadataAccessToken', () => {
  it('caches the token until shortly before it expires', async () => {
    const { fetch, calls } = fake([
      Response.json({ access_token: 'first', expires_in: 3600 }),
      Response.json({ access_token: 'second', expires_in: 3600 }),
    ]);
    const clock = { now: 0 };
    const token = metadataAccessToken(fetch, () => clock.now);

    assert.equal(await token(), 'first');
    clock.now = 3_500_000;
    assert.equal(await token(), 'first');
    clock.now = 3_550_000;
    assert.equal(await token(), 'second');
    assert.equal(calls.length, 2);
  });
});

describe('visitorId', () => {
  it('is stable, salted and never contains the address', () => {
    const id = visitorId('203.0.113.7', 'salt');

    assert.equal(id, visitorId('203.0.113.7', 'salt'));
    assert.notEqual(id, visitorId('203.0.113.7', 'other salt'));
    assert.notEqual(id, visitorId('203.0.113.8', 'salt'));
    assert.match(id, /^[0-9a-f]{64}$/);
  });

  it('identifies an IPv6 visitor by its /64 network', () => {
    assert.equal(
      visitorId('2001:db8:1:2:aaaa::1', 'salt'),
      visitorId('2001:0db8:0001:0002:ffff:ffff:ffff:ffff', 'salt'),
    );
    assert.notEqual(visitorId('2001:db8:1:2::1', 'salt'), visitorId('2001:db8:1:3::1', 'salt'));
  });

  it('treats an IPv4-mapped IPv6 address as the IPv4 address', () => {
    assert.equal(visitorId('::ffff:203.0.113.7', 'salt'), visitorId('203.0.113.7', 'salt'));
  });
});
