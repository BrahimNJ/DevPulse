import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_PORT, isAllowedHost, parsePort } from './host.ts';

describe('isAllowedHost', () => {
  it('accepts the loopback address and localhost on the server port', () => {
    assert.equal(isAllowedHost('127.0.0.1:5173', 5173), true);
    assert.equal(isAllowedHost('localhost:5173', 5173), true);
  });

  it('rejects a rebound domain, another port, or a missing header', () => {
    assert.equal(isAllowedHost('attacker.example:5173', 5173), false);
    assert.equal(isAllowedHost('127.0.0.1:8080', 5173), false);
    assert.equal(isAllowedHost(undefined, 5173), false);
  });
});

describe('parsePort', () => {
  it('defaults when unset and accepts a valid port', () => {
    assert.equal(parsePort(undefined), DEFAULT_PORT);
    assert.equal(parsePort('3000'), 3000);
  });

  it('rejects values that are not a TCP port', () => {
    for (const value of ['', 'abc', '0', '65536', '30.5']) {
      assert.equal(parsePort(value), null, value);
    }
  });
});
