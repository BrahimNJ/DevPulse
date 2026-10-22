import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_PORT, isAllowedHost, parsePort } from './host.ts';

describe('isAllowedHost', () => {
  const allowed = new Set(['127.0.0.1:5173', 'localhost:5173']);

  it('accepts the configured names, whatever their case', () => {
    assert.equal(isAllowedHost('127.0.0.1:5173', allowed), true);
    assert.equal(isAllowedHost('LocalHost:5173', allowed), true);
  });

  it('rejects a rebound domain, another port, or a missing header', () => {
    assert.equal(isAllowedHost('attacker.example:5173', allowed), false);
    assert.equal(isAllowedHost('127.0.0.1:8080', allowed), false);
    assert.equal(isAllowedHost(undefined, allowed), false);
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
