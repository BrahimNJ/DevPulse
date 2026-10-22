import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RateLimiter } from './rate-limit.ts';

function limiter(maxClients = 10): { limiter: RateLimiter; clock: { now: number } } {
  const clock = { now: 0 };
  return {
    limiter: new RateLimiter({ limitPerMinute: 3, maxClients, now: () => clock.now }),
    clock,
  };
}

describe('RateLimiter', () => {
  it('allows a burst up to the limit, then asks the client to wait for a token', () => {
    const { limiter: limit } = limiter();

    assert.deepEqual(
      [1, 2, 3].map(() => limit.take('a').allowed),
      [true, true, true],
    );
    // Three per minute refill one token every 20 seconds.
    assert.deepEqual(limit.take('a'), { allowed: false, retryAfterSeconds: 20 });
  });

  it('refills tokens over time without exceeding the limit', () => {
    const { limiter: limit, clock } = limiter();
    [1, 2, 3].forEach(() => limit.take('a'));

    clock.now = 20_000;
    assert.equal(limit.take('a').allowed, true);
    assert.equal(limit.take('a').allowed, false);

    clock.now = 10 * 60_000;
    assert.deepEqual(
      [1, 2, 3, 4].map(() => limit.take('a').allowed),
      [true, true, true, false],
    );
  });

  it('limits each client separately', () => {
    const { limiter: limit } = limiter();
    [1, 2, 3].forEach(() => limit.take('a'));

    assert.equal(limit.take('a').allowed, false);
    assert.equal(limit.take('b').allowed, true);
  });

  it('forgets the least recently seen client beyond its capacity', () => {
    const { limiter: limit } = limiter(1);
    [1, 2, 3].forEach(() => limit.take('a'));

    limit.take('b');

    assert.equal(limit.take('a').allowed, true);
  });
});
