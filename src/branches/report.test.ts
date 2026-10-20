import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildBranchReport, type Branch } from './report.ts';

const NOW = new Date('2026-10-20T12:00:00Z');

function branch(name: string, date: string, isProtected = false): Branch {
  return {
    name,
    isProtected,
    lastCommit: { sha: `sha-${name}`, date: new Date(date), author: 'dev' },
  };
}

describe('buildBranchReport', () => {
  it('computes age in whole days and flags branches at or over the stale threshold', () => {
    const report = buildBranchReport(
      {
        owner: 'acme',
        name: 'app',
        defaultBranch: 'main',
        branches: [
          branch('fresh', '2026-10-19T12:00:00Z'),
          branch('limit', '2026-07-22T12:00:00Z'),
          branch('almost', '2026-07-22T12:00:01Z'),
        ],
      },
      { now: NOW, staleDays: 90 },
    );

    const byName = new Map(report.branches.map((b) => [b.name, b]));
    assert.equal(byName.get('fresh')?.ageDays, 1);
    assert.equal(byName.get('fresh')?.isStale, false);
    assert.equal(byName.get('limit')?.ageDays, 90);
    assert.equal(byName.get('limit')?.isStale, true);
    assert.equal(byName.get('almost')?.ageDays, 89);
    assert.equal(byName.get('almost')?.isStale, false);
  });

  it('never reports the default branch as stale', () => {
    const report = buildBranchReport(
      {
        owner: 'acme',
        name: 'app',
        defaultBranch: 'main',
        branches: [branch('main', '2020-01-01T00:00:00Z')],
      },
      { now: NOW, staleDays: 90 },
    );

    const [main] = report.branches;
    assert.ok(main);
    assert.equal(main.isDefault, true);
    assert.equal(main.isStale, false);
    assert.equal(report.totals.stale, 0);
  });

  it('sorts by most recent commit, then by name, and counts totals', () => {
    const report = buildBranchReport(
      {
        owner: 'acme',
        name: 'app',
        defaultBranch: 'main',
        branches: [
          branch('old', '2025-01-01T00:00:00Z'),
          branch('main', '2026-10-20T00:00:00Z', true),
          branch('b-feature', '2026-10-01T00:00:00Z'),
          branch('a-feature', '2026-10-01T00:00:00Z', true),
        ],
      },
      { now: NOW, staleDays: 30 },
    );

    assert.equal(report.repository, 'acme/app');
    assert.deepEqual(
      report.branches.map((b) => b.name),
      ['main', 'a-feature', 'b-feature', 'old'],
    );
    assert.deepEqual(report.totals, { branches: 4, protected: 2, stale: 1 });
  });

  it('treats a commit dated in the future as zero days old', () => {
    const report = buildBranchReport(
      {
        owner: 'acme',
        name: 'app',
        defaultBranch: null,
        branches: [branch('skewed', '2026-10-21T00:00:00Z')],
      },
      { now: NOW, staleDays: 1 },
    );

    const [skewed] = report.branches;
    assert.ok(skewed);
    assert.equal(skewed.ageDays, 0);
    assert.equal(skewed.isStale, false);
  });
});
