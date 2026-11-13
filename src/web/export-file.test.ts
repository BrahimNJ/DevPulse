import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportFileName } from './export-file.ts';

describe('export file name', () => {
  it('names the repository, the report and the day', () => {
    assert.equal(
      exportFileName('nodejs/node', 'branches', '2026-11-13T09:30:00.000Z', 'markdown'),
      'devpulse-nodejs-node-branches-2026-11-13.md',
    );
    assert.equal(
      exportFileName('acme/rocket_ship.js', 'branches', '2026-11-13T09:30:00.000Z', 'csv'),
      'devpulse-acme-rocket_ship.js-branches-2026-11-13.csv',
    );
  });

  it('replaces any character a file system could refuse', () => {
    assert.equal(
      exportFileName('a b/c:d', 'branches', '2026-11-13T09:30:00.000Z', 'csv'),
      'devpulse-a-b-c-d-branches-2026-11-13.csv',
    );
  });
});
