import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  deviceOf,
  languageOf,
  MemoryEventStore,
  outcomeOf,
  summarise,
  type AnalysisEvent,
} from './analytics.ts';

const NOW = new Date('2026-10-23T12:00:00Z');

function event(overrides: Partial<AnalysisEvent> = {}): AnalysisEvent {
  return {
    at: new Date('2026-10-23T10:00:00Z'),
    report: 'branches',
    repository: 'acme/app',
    visitor: 'v1',
    owner: false,
    status: 200,
    outcome: 'ok',
    durationMs: 200,
    cacheHit: false,
    device: 'desktop',
    language: 'fr',
    ...overrides,
  };
}

const OPTIONS = { now: NOW, days: 3, truncated: false, github: null };

describe('analytics', () => {
  it('names the outcome behind each status', () => {
    assert.equal(outcomeOf(200, false), 'ok');
    assert.equal(outcomeOf(404, false), 'not-found');
    assert.equal(outcomeOf(429, true), 'allowance');
    assert.equal(outcomeOf(429, false), 'rate-limited');
    assert.equal(outcomeOf(504, false), 'timeout');
    assert.equal(outcomeOf(500, false), 'error');
  });

  it('keeps only a coarse device class and the first language', () => {
    assert.equal(deviceOf('Mozilla/5.0 (Linux; Android 15) Mobile Safari'), 'mobile');
    assert.equal(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
    assert.equal(deviceOf('GoogleStackdriverMonitoring-UptimeChecks'), 'bot');
    assert.equal(deviceOf(undefined), 'bot');
    assert.equal(languageOf('fr-FR,fr;q=0.9,en;q=0.8'), 'fr');
    assert.equal(languageOf('en-GB'), 'en');
    assert.equal(languageOf('de-DE'), 'other');
    assert.equal(languageOf(undefined), 'other');
  });

  it('summarises analyses, failures and visitors, without the owner', () => {
    const events = [
      event({ visitor: 'v2', outcome: 'not-found', status: 404, repository: 'acme/typo' }),
      event({ durationMs: 900, at: new Date('2026-10-22T09:00:00Z') }),
      event({ durationMs: 100, cacheHit: true }),
      event({ report: 'delivery', durationMs: 5000 }),
      event({ visitor: 'v3', outcome: 'allowance', status: 429, cacheHit: null }),
      event({ visitor: 'me', owner: true, repository: 'mine/own' }),
    ];
    const stats = summarise(events, OPTIONS);

    assert.deepEqual(stats.totals, {
      visitors: 3,
      analyses: 4,
      succeeded: 2,
      failed: 2,
      deliveryOpened: 1,
      repositories: 2,
      cacheHitRate: 0.25,
      medianMs: 100,
      p90Ms: 900,
      allowanceReached: 1,
    });
    assert.deepEqual(stats.perDay, [
      { date: '2026-10-21', succeeded: 0, failed: 0, visitors: 0 },
      { date: '2026-10-22', succeeded: 1, failed: 0, visitors: 1 },
      { date: '2026-10-23', succeeded: 1, failed: 2, visitors: 3 },
    ]);
    assert.deepEqual(stats.outcomes, [
      { outcome: 'allowance', count: 1 },
      { outcome: 'not-found', count: 1 },
    ]);
    assert.deepEqual(stats.repositories, [
      { name: 'acme/app', analyses: 3, failed: 1 },
      { name: 'acme/typo', analyses: 1, failed: 1 },
    ]);
    assert.deepEqual(
      stats.failures.map((failure) => failure.repository),
      ['acme/typo', 'acme/app'],
    );
  });

  it('reports an empty period without dividing by zero', () => {
    const stats = summarise([], OPTIONS);

    assert.equal(stats.totals.analyses, 0);
    assert.equal(stats.totals.cacheHitRate, null);
    assert.equal(stats.totals.medianMs, null);
    assert.equal(stats.perDay.length, 3);
  });

  it('returns the newest events of the period first', async () => {
    const store = new MemoryEventStore();
    await store.add(event({ at: new Date('2026-10-20T00:00:00Z') }));
    await store.add(event({ at: new Date('2026-10-23T00:00:00Z') }));
    await store.add(event({ at: new Date('2026-10-22T00:00:00Z') }));

    const recent = await store.recent(new Date('2026-10-21T00:00:00Z'), 10);

    assert.deepEqual(
      recent.map((item) => item.at.toISOString().slice(0, 10)),
      ['2026-10-23', '2026-10-22'],
    );
  });
});
