import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AnalysisEvent } from './analytics.ts';
import { FirestoreEventStore } from './firestore-events.ts';

const EVENT: AnalysisEvent = {
  at: new Date('2026-10-23T10:00:00Z'),
  report: 'delivery',
  repository: 'acme/app',
  visitor: 'a1b2',
  owner: false,
  status: 200,
  outcome: 'ok',
  durationMs: 1234.4,
  cacheHit: null,
  device: 'mobile',
  language: 'fr',
};

interface Call {
  readonly url: string;
  readonly body: unknown;
}

function store(answer: unknown, status = 200): { store: FirestoreEventStore; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Promise.resolve(new Response(JSON.stringify(answer), { status }));
  };
  return {
    store: new FirestoreEventStore({
      project: 'demo',
      accessToken: () => Promise.resolve('token'),
      fetch,
      retentionMs: 86_400_000,
    }),
    calls,
  };
}

describe('FirestoreEventStore', () => {
  it('writes an event with its expiry', async () => {
    const { store: events, calls } = store({});

    await events.add(EVENT);

    const [call] = calls;
    assert.ok(call);
    assert.equal(
      call.url,
      'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents/events',
    );
    const { fields } = call.body as { fields: Record<string, unknown> };
    assert.deepEqual(fields['durationMs'], { integerValue: '1234' });
    assert.deepEqual(fields['cacheHit'], { nullValue: null });
    assert.deepEqual(fields['expireAt'], { timestampValue: '2026-10-24T10:00:00.000Z' });
  });

  it('reads the newest events of a period back', async () => {
    const { store: events, calls } = store([
      {
        document: {
          fields: {
            at: { timestampValue: '2026-10-23T10:00:00Z' },
            report: { stringValue: 'delivery' },
            repository: { stringValue: 'acme/app' },
            visitor: { stringValue: 'a1b2' },
            owner: { booleanValue: false },
            status: { integerValue: '200' },
            outcome: { stringValue: 'ok' },
            durationMs: { integerValue: '1234' },
            cacheHit: { nullValue: null },
            device: { stringValue: 'mobile' },
            language: { stringValue: 'fr' },
          },
        },
      },
      { readTime: '2026-10-23T12:00:00Z' },
    ]);

    const recent = await events.recent(new Date('2026-10-16T12:00:00Z'), 50);

    assert.deepEqual(recent, [{ ...EVENT, durationMs: 1234 }]);
    const query = (calls[0]?.body as { structuredQuery: { limit: number } }).structuredQuery;
    assert.ok(calls[0]?.url.endsWith('/documents:runQuery'));
    assert.equal(query.limit, 50);
  });

  it('fails loudly when Firestore refuses', async () => {
    const { store: events } = store({ error: { status: 'PERMISSION_DENIED' } }, 403);

    await assert.rejects(events.add(EVENT), /PERMISSION_DENIED/);
  });
});
