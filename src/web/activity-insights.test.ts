import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildActivityInsights,
  heatLevels,
  releasesIn,
  verdictSentence,
  windowOf,
} from './activity-insights.ts';
import type { ActivityReportResponse } from './api.ts';
import { DEMO_ACTIVITY_REPORT } from './demo.ts';
import { messagesFor } from './i18n.ts';

const en = messagesFor('en');

function withWindow(
  months: 3 | 6 | 12,
  changes: Partial<ActivityReportResponse['windows'][number]>,
): ActivityReportResponse {
  return {
    ...DEMO_ACTIVITY_REPORT,
    windows: DEMO_ACTIVITY_REPORT.windows.map((period) =>
      period.months === months ? { ...period, ...changes } : period,
    ),
  };
}

describe('activity insights', () => {
  it('describes the verdict of a window with its figures', () => {
    const report = withWindow(3, { verdict: 'growing', change: 0.42 });

    assert.equal(
      verdictSentence(report, windowOf(report, 3), en, 'en'),
      'nodejs/node commits more: +42% in the second half of the last 3 months than in the first.',
    );
  });

  it('flags a project that depends on one or two people', () => {
    const concentration = { people: 1, contributors: 3, top: [{ login: 'ada', share: 0.7 }] };
    const report = withWindow(6, { concentration });
    const [first] = buildActivityInsights(report, 6, en, 'en');

    assert.equal(first?.tone, 'warn');
    assert.match(first.text, /from 1 person/);
  });

  it('warns when no person has committed for three months', () => {
    const report: ActivityReportResponse = {
      ...DEMO_ACTIVITY_REPORT,
      maintenance: { lastHumanWeek: '2026-05-03T00:00:00.000Z', lastCommitWeek: null },
    };
    const insights = buildActivityInsights(report, 12, en, 'en');

    assert.ok(insights.some((insight) => insight.text.startsWith('No commit by a person')));
    assert.ok(insights.length <= 4);
  });

  it('reports the newcomers of the latest block', () => {
    const insights = buildActivityInsights(DEMO_ACTIVITY_REPORT, 12, en, 'en');

    assert.ok(insights.some((insight) => insight.text.includes('made their first commit')));
  });
});

describe('activity charts', () => {
  it('ranks busy days in four levels and keeps 0 for an empty day', () => {
    const [week] = DEMO_ACTIVITY_REPORT.weeks;
    assert.ok(week !== undefined);
    const level = heatLevels([{ ...week, days: [0, 1, 2, 3, 4, 5, 6] }]);

    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(level), [0, 1, 1, 2, 2, 3, 4]);
  });

  it('finds the releases of a week', () => {
    const releases = [
      { tag: 'v2', publishedAt: '2026-10-20T10:00:00.000Z' },
      { tag: 'v1', publishedAt: '2026-10-10T10:00:00.000Z' },
    ];

    assert.deepEqual(
      releasesIn(releases, '2026-10-18T00:00:00.000Z').map((release) => release.tag),
      ['v2'],
    );
  });
});
