import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BranchReportResponse, BranchRow } from './api.ts';
import { messagesFor } from './i18n.ts';
import { describeQuota, timeUntil } from './quota.ts';
import { buildInsights } from './report-insights.ts';

const en = messagesFor('en');
const fr = messagesFor('fr');

function branch(name: string, overrides: Partial<BranchRow> = {}): BranchRow {
  return {
    name,
    isProtected: false,
    isDefault: false,
    isStale: false,
    ageDays: 3,
    lastCommit: { sha: 'a', date: '2026-10-19T00:00:00.000Z', author: null },
    divergence: null,
    ...overrides,
  };
}

function report(
  branches: readonly BranchRow[],
  totals: BranchReportResponse['totals'],
): BranchReportResponse {
  return {
    repository: 'acme/app',
    defaultBranch: 'main',
    generatedAt: '2026-10-22T00:00:00.000Z',
    staleDays: 90,
    totals,
    branches,
  };
}

describe('buildInsights', () => {
  it('describes abandoned work, protection and the branch furthest behind', () => {
    const insights = buildInsights(
      report(
        [
          branch('main', { isDefault: true, isProtected: true }),
          branch('old', { isStale: true, ageDays: 400, divergence: { ahead: 2, behind: 150 } }),
          branch('recent', { divergence: { ahead: 1, behind: 4 } }),
        ],
        { branches: 3, protected: 1, stale: 1 },
      ),
      en,
      'en',
    );

    assert.deepEqual(
      insights.map((insight) => [insight.tone, insight.title]),
      [
        ['info', '33% of branches look abandoned'],
        ['ok', '1 protected branch'],
        ['warn', 'old is the furthest behind'],
      ],
    );
    assert.match(insights[2]?.text ?? '', /150 commits behind main, last commit: 13\u00a0months/);
  });

  it('praises a repository without abandoned work and warns about missing protection', () => {
    const insights = buildInsights(
      report([branch('main', { isDefault: true })], { branches: 1, protected: 0, stale: 0 }),
      en,
      'en',
    );

    assert.deepEqual(
      insights.map((insight) => insight.title),
      ['No abandoned work', 'Nothing is protected'],
    );
  });

  it('writes the same findings in French', () => {
    const insights = buildInsights(
      report(
        [
          branch('main', { isDefault: true, isProtected: true }),
          branch('old', { isStale: true, ageDays: 400, divergence: { ahead: 2, behind: 150 } }),
          branch('recent'),
        ],
        { branches: 3, protected: 1, stale: 1 },
      ),
      fr,
      'fr',
    );

    assert.deepEqual(
      insights.map((insight) => insight.title),
      [
        '33\u00a0% des branches semblent abandonnées',
        '1 branch protégée',
        'old est la plus en retard',
      ],
    );
    assert.equal(
      insights[2]?.text,
      '150 commits de retard sur main, dernier commit\u202f: 13\u00a0mois.',
    );
    assert.equal(
      describeQuota({ owner: false, limit: 3, remaining: 2, resetsAt: null }, fr, 'fr'),
      "2 analyses restantes sur 3 aujourd'hui",
    );
    // French treats 0 and 1 as singular.
    assert.equal(
      describeQuota({ owner: false, limit: 3, remaining: 1, resetsAt: null }, fr, 'fr'),
      "1 analyse restante sur 3 aujourd'hui",
    );
    assert.equal(
      describeQuota({ owner: false, limit: 3, remaining: 0, resetsAt: null }, fr, 'fr'),
      "0 analyse restante sur 3 aujourd'hui",
    );
  });

  it('handles an empty repository', () => {
    assert.equal(
      buildInsights(report([], { branches: 0, protected: 0, stale: 0 }), en, 'en')[0]?.title,
      'No branches',
    );
  });
});

describe('quota wording', () => {
  it('describes the allowance, the owner, or nothing', () => {
    const base = { owner: false, resetsAt: null };
    assert.equal(
      describeQuota({ ...base, limit: 3, remaining: 2 }, en, 'en'),
      '2 of 3 analyses left today',
    );
    assert.equal(
      describeQuota({ owner: true, limit: null, remaining: null, resetsAt: null }, en, 'en'),
      'Unlimited · owner',
    );
    assert.equal(describeQuota({ ...base, limit: null, remaining: null }, en, 'en'), null);
    assert.equal(describeQuota(null, en, 'en'), null);
  });

  it('says when the allowance comes back', () => {
    const now = new Date('2026-10-22T10:00:00Z');
    assert.equal(timeUntil('2026-10-23T00:12:00Z', en, now), 'in 14 h 12 min');
    assert.equal(timeUntil('2026-10-22T10:05:00Z', en, now), 'in 5 min');
    assert.equal(timeUntil(null, en, now), 'within 24 hours');
  });
});
