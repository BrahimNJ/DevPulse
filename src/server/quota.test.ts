import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MemoryQuotaStore,
  QuotaConflictError,
  VisitorQuota,
  type QuotaStore,
  type StoredRecord,
} from './quota.ts';

const DAY = 86_400_000;

function quota(store: QuotaStore = new MemoryQuotaStore()): {
  quota: VisitorQuota;
  clock: { now: number };
} {
  const clock = { now: Date.UTC(2026, 9, 22) };
  return {
    quota: new VisitorQuota({ store, limit: 3, windowMs: DAY, now: () => new Date(clock.now) }),
    clock,
  };
}

describe('VisitorQuota', () => {
  it('allows three distinct repositories, then refuses a fourth', async () => {
    const { quota: allowance } = quota();

    for (const repository of ['a/one', 'a/two', 'a/three']) {
      assert.equal((await allowance.reserve('visitor', repository)).allowed, true);
    }
    const refused = await allowance.reserve('visitor', 'a/four');

    assert.equal(refused.allowed, false);
    assert.equal(refused.status.remaining, 0);
    assert.deepEqual(refused.status.resetsAt, new Date(Date.UTC(2026, 9, 23)));
  });

  it('never charges a repository twice, whatever its case', async () => {
    const { quota: allowance } = quota();

    const first = await allowance.reserve('visitor', 'Acme/App');
    const again = await allowance.reserve('visitor', 'acme/app');

    assert.equal(first.charged, true);
    assert.equal(again.allowed, true);
    assert.equal(again.charged, false);
    assert.equal(again.status.remaining, 2);
  });

  it('starts a fresh window once the previous one has ended', async () => {
    const { quota: allowance, clock } = quota();
    for (const repository of ['a/one', 'a/two', 'a/three']) {
      await allowance.reserve('visitor', repository);
    }

    clock.now += DAY;

    assert.equal((await allowance.reserve('visitor', 'a/four')).allowed, true);
    assert.equal((await allowance.status('visitor')).remaining, 2);
  });

  it('counts each visitor separately and reports an unused allowance', async () => {
    const { quota: allowance } = quota();
    await allowance.reserve('first', 'a/one');

    assert.deepEqual(await allowance.status('second'), { limit: 3, remaining: 3, resetsAt: null });
  });

  it('gives a slot back for a repository that does not exist', async () => {
    const { quota: allowance } = quota();
    await allowance.reserve('visitor', 'a/missing');

    await allowance.release('visitor', 'A/Missing');

    assert.equal((await allowance.status('visitor')).remaining, 3);
  });

  it('never grants the last slot twice to concurrent requests', async () => {
    const { quota: allowance } = quota();
    await allowance.reserve('visitor', 'a/one');
    await allowance.reserve('visitor', 'a/two');

    const results = await Promise.all(
      ['a/three', 'a/four', 'a/five'].map((repository) => allowance.reserve('visitor', repository)),
    );

    assert.equal(results.filter((result) => result.allowed).length, 1);
  });

  it('gives up when every write loses to a concurrent writer', async () => {
    const losing: QuotaStore = {
      get: (): Promise<StoredRecord | null> => Promise.resolve(null),
      put: (): Promise<boolean> => Promise.resolve(false),
    };

    await assert.rejects(quota(losing).quota.reserve('visitor', 'a/one'), QuotaConflictError);
  });
});
