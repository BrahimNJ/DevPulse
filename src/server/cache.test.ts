import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TtlCache } from './cache.ts';

function cache(maxEntries = 10): { cache: TtlCache<string>; clock: { now: number } } {
  const clock = { now: 0 };
  return { cache: new TtlCache({ ttlMs: 1000, maxEntries, now: () => clock.now }), clock };
}

describe('TtlCache', () => {
  it('serves a stored value until it expires', async () => {
    const { cache: store, clock } = cache();
    let loads = 0;
    const load = (): Promise<string> => Promise.resolve(`value-${String(++loads)}`);

    assert.deepEqual(await store.getOrLoad('k', load), { value: 'value-1', hit: false });
    clock.now = 999;
    assert.deepEqual(await store.getOrLoad('k', load), { value: 'value-1', hit: true });
    clock.now = 1000;
    assert.deepEqual(await store.getOrLoad('k', load), { value: 'value-2', hit: false });
  });

  it('shares one load between concurrent calls for the same key', async () => {
    const { cache: store } = cache();
    let loads = 0;
    const load = async (): Promise<string> => {
      loads += 1;
      await Promise.resolve();
      return 'value';
    };

    const results = await Promise.all([1, 2, 3].map(() => store.getOrLoad('k', load)));

    assert.equal(loads, 1);
    assert.deepEqual(
      results.map((result) => result.hit),
      [false, true, true],
    );
  });

  it('does not cache a failed load', async () => {
    const { cache: store } = cache();

    await assert.rejects(store.getOrLoad('k', () => Promise.reject(new Error('boom'))));
    const result = await store.getOrLoad('k', () => Promise.resolve('value'));

    assert.deepEqual(result, { value: 'value', hit: false });
  });

  it('evicts the least recently used entry beyond its size', async () => {
    const { cache: store } = cache(2);
    const load = (value: string) => (): Promise<string> => Promise.resolve(value);

    await store.getOrLoad('a', load('a'));
    await store.getOrLoad('b', load('b'));
    await store.getOrLoad('a', load('unused'));
    await store.getOrLoad('c', load('c'));

    assert.equal(store.size, 2);
    assert.equal((await store.getOrLoad('a', load('reloaded'))).hit, true);
    assert.equal((await store.getOrLoad('b', load('reloaded'))).hit, false);
  });
});
