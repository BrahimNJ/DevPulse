import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clientIp } from './client-ip.ts';

describe('clientIp', () => {
  it('uses the entry appended by a trusted proxy, not the forgeable ones before it', () => {
    assert.equal(clientIp('6.6.6.6, 203.0.113.7', '10.0.0.1', true), '203.0.113.7');
    assert.equal(clientIp(['6.6.6.6', '203.0.113.7'], '10.0.0.1', true), '203.0.113.7');
  });

  it('ignores the header without a trusted proxy', () => {
    assert.equal(clientIp('6.6.6.6', '127.0.0.1', false), '127.0.0.1');
  });

  it('falls back to the socket address when the header is missing or empty', () => {
    assert.equal(clientIp(undefined, '10.0.0.1', true), '10.0.0.1');
    assert.equal(clientIp(' ', '10.0.0.1', true), '10.0.0.1');
    assert.equal(clientIp(undefined, undefined, true), 'unknown');
  });
});
