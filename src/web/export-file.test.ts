import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBlob, exportFileName } from './export-file.ts';

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

describe('export file content', () => {
  it('types a Markdown file and keeps its text as it is', async () => {
    const blob = exportBlob('# Réseau', 'markdown');
    assert.equal(blob.type, 'text/markdown;charset=utf-8');
    assert.equal(await blob.text(), '# Réseau');
  });

  it('starts a CSV file with a byte order mark for spreadsheets', async () => {
    const blob = exportBlob('branch\r\n', 'csv');
    assert.equal(blob.type, 'text/csv;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  });
});
