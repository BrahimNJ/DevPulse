import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildActivityReport,
  concentration,
  median,
  verdict,
  type ActivityData,
  type Contributor,
} from './report.ts';

const WEEK_MS = 7 * 86_400_000;
/** A Sunday, as GitHub starts its weeks. */
const LAST_WEEK = Date.parse('2026-10-25T00:00:00Z');
/** Wednesday of the last week: that week is still in progress. */
const NOW = new Date('2026-10-28T12:00:00Z');

function weekStart(weeksAgo: number): Date {
  return new Date(LAST_WEEK - weeksAgo * WEEK_MS);
}

/** 52 weeks, oldest first, with the commit totals given oldest first. */
function weeks(totals: readonly number[]): ActivityData['weeks'] {
  return totals.map((total, index) => ({
    start: weekStart(totals.length - 1 - index),
    days: [0, total, 0, 0, 0, 0, 0],
    total,
  }));
}

function person(
  login: string,
  commits: Readonly<Record<number, number>>,
  options: { isBot?: boolean; total?: number } = {},
): Contributor {
  const entries = Object.entries(commits)
    .map(([weeksAgo, count]) => ({ start: weekStart(Number(weeksAgo)), commits: count }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return {
    login,
    isBot: options.isBot ?? false,
    total: options.total ?? entries.reduce((sum, week) => sum + week.commits, 0),
    weeks: entries,
  };
}

function punchCard(cells: readonly [number, number, number][] = []): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const [day, hour, count] of cells) {
    const row = grid[day];
    if (row !== undefined) {
      row[hour] = count;
    }
  }
  return grid;
}

function data(overrides: Partial<ActivityData> = {}): ActivityData {
  return {
    owner: 'acme',
    name: 'app',
    weeks: weeks(Array.from({ length: 52 }, () => 10)),
    contributors: [],
    truncated: false,
    punchCard: punchCard(),
    ...overrides,
  };
}

describe('buildActivityReport', () => {
  it('marks the current week as partial and leaves it out of the rolling median', () => {
    const report = buildActivityReport(data(), { now: NOW });

    assert.equal(report.weeks.length, 52);
    assert.equal(report.weeks.at(-1)?.partial, true);
    assert.equal(report.weeks.at(-1)?.rollingMedian, null);
    assert.equal(report.weeks.at(-2)?.partial, false);
    assert.equal(report.weeks.at(-2)?.rollingMedian, 10);
    assert.equal(report.weeks[6]?.rollingMedian, null);
    assert.equal(report.weeks[7]?.rollingMedian, 10);
  });

  it('compares the halves of each window, without the week in progress', () => {
    // 26 quiet weeks, then 25 busy complete weeks and a partial one.
    const totals = [...Array.from({ length: 26 }, () => 4), ...Array.from({ length: 26 }, () => 8)];
    const report = buildActivityReport(data({ weeks: weeks(totals) }), { now: NOW });
    const [quarter, half, year] = report.windows;

    assert.deepEqual(
      report.windows.map((window) => [window.months, window.weeks]),
      [
        [3, 13],
        [6, 26],
        [12, 52],
      ],
    );
    assert.ok(quarter !== undefined && half !== undefined && year !== undefined);
    assert.equal(quarter.change, 0);
    assert.equal(quarter.verdict, 'steady');
    assert.equal(half.commits, 26 * 8);
    assert.equal(half.perWeek, 8);
    assert.equal(year.verdict, 'growing');
    assert.ok(year.change !== null && year.change > 0.9);
  });

  it('measures concentration among humans and keeps bots apart', () => {
    const contributors = [
      person('ada', { 1: 30, 40: 10 }, { total: 400 }),
      person('bob', { 2: 10 }, { total: 400 }),
      person('cy', { 3: 10 }, { total: 50 }),
      person('renovate[bot]', { 1: 50 }, { isBot: true, total: 900 }),
    ];
    const report = buildActivityReport(data({ contributors }), { now: NOW });
    const [quarter, , year] = report.windows;

    assert.ok(quarter !== undefined && year !== undefined);
    assert.equal(quarter.concentration.people, 1);
    assert.equal(quarter.concentration.contributors, 3);
    assert.deepEqual(
      quarter.concentration.top.map((entry) => entry.login),
      ['ada', 'bob', 'cy'],
    );
    assert.equal(quarter.concentration.top[0]?.share, 0.6);
    assert.equal(quarter.botShare, 0.5);
    // 100 attributed commits out of 130 in the last 13 weeks.
    assert.equal(quarter.coverage, 100 / 130);
    assert.equal(year.concentration.people, 1);
    assert.equal(report.allTime.people, 2);
    assert.equal(report.allTime.contributors, 3);
  });

  it('counts newcomers per week and the flow of people per quarter', () => {
    const contributors = [
      person('old', { 60: 1, 30: 2, 20: 3, 5: 4 }),
      person('gone', { 45: 1, 30: 1 }),
      person('back', { 50: 2, 3: 1 }),
      person('new', { 2: 5 }),
    ];
    const report = buildActivityReport(data({ contributors }), { now: NOW });

    assert.equal(report.weeks.at(-3)?.newcomers, 1);
    assert.equal(report.weeks.at(-3)?.humans, 1);
    assert.equal(report.flow.length, 4);
    assert.deepEqual(report.flow.at(-1), {
      start: weekStart(12),
      active: 3,
      newcomers: 1,
      retained: 1,
      returning: 1,
      lapsed: 0,
    });
    // Weeks 25 to 13 ago: old was active, gone left after the block before.
    assert.deepEqual(report.flow.at(-2), {
      start: weekStart(25),
      active: 1,
      newcomers: 0,
      retained: 1,
      returning: 0,
      lapsed: 1,
    });
  });

  it('describes the rhythm and the latest human commit', () => {
    const report = buildActivityReport(
      data({
        punchCard: punchCard([
          [0, 22, 2],
          [2, 14, 6],
          [3, 20, 2],
        ]),
        contributors: [
          person('ada', { 9: 1 }),
          person('dependabot[bot]', { 0: 3 }, { isBot: true }),
        ],
      }),
      { now: NOW },
    );

    assert.equal(report.rhythm.total, 10);
    assert.equal(report.rhythm.weekendShare, 0.2);
    assert.equal(report.rhythm.officeHoursShare, 0.6);
    assert.deepEqual(report.rhythm.peak, { day: 2, hour: 14 });
    assert.deepEqual(report.maintenance.lastHumanWeek, weekStart(9));
    assert.deepEqual(report.maintenance.lastCommitWeek, weekStart(0));
  });

  it('reports an empty repository without failing', () => {
    const report = buildActivityReport(
      data({ weeks: [], contributors: [], punchCard: punchCard() }),
      { now: NOW },
    );

    assert.deepEqual(report.weeks, []);
    assert.deepEqual(report.flow, []);
    assert.equal(report.windows[0]?.verdict, 'dormant');
    assert.equal(report.windows[0].coverage, null);
    assert.equal(report.rhythm.peak, null);
    assert.equal(report.maintenance.lastHumanWeek, null);
    assert.equal(report.limits.truncated, false);
  });

  it('says when GitHub listed its maximum of contributors', () => {
    const contributors = Array.from({ length: 99 }, (_, index) =>
      person(`user${String(index)}`, { 1: 1 }),
    );
    const report = buildActivityReport(data({ contributors, truncated: true }), { now: NOW });

    assert.deepEqual(report.limits, { contributorsListed: 99, truncated: true });
  });
});

describe('verdict', () => {
  it('ranks dormant, quiet, slowing, growing and steady', () => {
    assert.equal(verdict(0, 0, null), 'dormant');
    assert.equal(verdict(5, 0.4, 2), 'quiet');
    assert.equal(verdict(50, 5, -0.3), 'slowing');
    assert.equal(verdict(50, 5, 0.3), 'growing');
    assert.equal(verdict(50, 5, 0.1), 'steady');
    assert.equal(verdict(50, 5, null), 'steady');
  });
});

describe('concentration', () => {
  it('finds the fewest people reaching half of the commits', () => {
    const result = concentration([
      ['a', 10],
      ['b', 10],
      ['c', 10],
      ['d', 10],
      ['e', 0],
    ]);

    assert.equal(result.people, 2);
    assert.equal(result.contributors, 4);
    assert.deepEqual(
      result.top.map((entry) => entry.share),
      [0.25, 0.25, 0.25, 0.25],
    );
    assert.equal(concentration([]).people, null);
  });
});

describe('median', () => {
  it('averages the middle pair of an even count', () => {
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([]), null);
  });
});
