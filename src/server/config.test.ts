import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('keeps the local-only behaviour by default', () => {
    assert.deepEqual(loadConfig({}), {
      host: '127.0.0.1',
      port: 5173,
      allowedHosts: new Set(['127.0.0.1:5173', 'localhost:5173']),
      trustProxy: false,
      rateLimitPerMinute: 30,
      visitors: { quotaPerDay: null, salt: null, firestoreProject: null, ownerKey: null },
    });
  });

  it('reads a deployment configuration', () => {
    assert.deepEqual(
      loadConfig({
        HOST: '0.0.0.0',
        PORT: '8080',
        ALLOWED_HOSTS: 'DevPulse-123.europe-west1.run.app, devpulse.example ',
        TRUST_PROXY: 'true',
        RATE_LIMIT_PER_MINUTE: '60',
      }),
      {
        host: '0.0.0.0',
        port: 8080,
        allowedHosts: new Set(['devpulse-123.europe-west1.run.app', 'devpulse.example']),
        trustProxy: true,
        rateLimitPerMinute: 60,
        visitors: { quotaPerDay: null, salt: null, firestoreProject: null, ownerKey: null },
      },
    );
  });

  it('derives the default allowed hosts from the port', () => {
    const config = loadConfig({ PORT: '3000' });
    assert.ok(typeof config !== 'string');
    assert.deepEqual(config.allowedHosts, new Set(['127.0.0.1:3000', 'localhost:3000']));
  });

  it('reads the visitor allowance and the owner key of a deployment', () => {
    const config = loadConfig({
      QUOTA_PER_DAY: '3',
      VISITOR_SALT: 'a-salt-of-at-least-twenty-chars',
      FIRESTORE_PROJECT: 'devpulse-test',
      OWNER_KEY: 'an-owner-key-of-twenty-chars',
    });
    assert.ok(typeof config !== 'string');
    assert.deepEqual(config.visitors, {
      quotaPerDay: 3,
      salt: 'a-salt-of-at-least-twenty-chars',
      firestoreProject: 'devpulse-test',
      ownerKey: 'an-owner-key-of-twenty-chars',
    });
  });

  it('rejects invalid values with a message naming the variable', () => {
    const cases = [
      [{ PORT: 'abc' }, /^PORT/],
      [{ TRUST_PROXY: 'yes' }, /^TRUST_PROXY/],
      [{ RATE_LIMIT_PER_MINUTE: '0' }, /^RATE_LIMIT_PER_MINUTE/],
      [{ HOST: '0.0.0.0' }, /^ALLOWED_HOSTS/],
      [{ QUOTA_PER_DAY: 'three' }, /^QUOTA_PER_DAY/],
      [{ QUOTA_PER_DAY: '3' }, /^VISITOR_SALT/],
      [{ QUOTA_PER_DAY: '3', VISITOR_SALT: 'short' }, /^VISITOR_SALT/],
      [{ OWNER_KEY: 'short' }, /^OWNER_KEY/],
    ] as const;
    for (const [env, message] of cases) {
      const config = loadConfig(env);
      assert.ok(typeof config === 'string');
      assert.match(config, message);
    }
  });
});
