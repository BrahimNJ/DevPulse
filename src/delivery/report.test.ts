import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDeliveryReport,
  percentile,
  sizeOf,
  type DeliveryData,
  type MergedPullRequest,
} from './report.ts';

const NOW = new Date('2026-10-23T00:00:00Z');
const HOUR = 3_600_000;

function pullRequest(
  number: number,
  leadHours: number,
  overrides: Partial<MergedPullRequest> = {},
): MergedPullRequest {
  const createdAt = new Date(NOW.getTime() - 10 * 24 * HOUR);
  return {
    number,
    title: `Change ${String(number)}`,
    createdAt,
    mergedAt: new Date(createdAt.getTime() + leadHours * HOUR),
    additions: 10,
    deletions: 5,
    author: 'alice',
    isBot: false,
    reviews: [],
    ...overrides,
  };
}

function data(overrides: Partial<DeliveryData> = {}): DeliveryData {
  return {
    owner: 'acme',
    name: 'app',
    windowDays: 90,
    searchIndexed: true,
    mergedCount: 100,
    sample: [],
    abandonedCount: 0,
    staleOpenCount: 0,
    revertCount: 0,
    weeklyMerged: [],
    releases: [],
    ...overrides,
  };
}

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(percentile(sorted, 0.5), 5);
    assert.equal(percentile(sorted, 0.9), 9);
    assert.equal(percentile([7], 0.9), 7);
    assert.equal(percentile([], 0.5), 0);
  });
});

describe('buildDeliveryReport', () => {
  it('measures lead time on human pull requests only', () => {
    const report = buildDeliveryReport(
      data({
        sample: [
          pullRequest(1, 2),
          pullRequest(2, 10),
          pullRequest(3, 30),
          pullRequest(4, 0.1, { isBot: true, author: 'dependabot' }),
        ],
      }),
      { now: NOW },
    );

    assert.deepEqual(report.leadTime, { medianHours: 10, p90Hours: 30, sampleSize: 3 });
    assert.equal(report.botShare, 0.25);
    assert.equal(report.bands.leadTime, 'elite');
  });

  it('times the first review by someone other than the author', () => {
    const at = (hours: number): Date => new Date(NOW.getTime() - 10 * 24 * HOUR + hours * HOUR);
    const report = buildDeliveryReport(
      data({
        sample: [
          pullRequest(1, 48, {
            reviews: [
              { author: 'alice', createdAt: at(1) },
              { author: 'bob', createdAt: at(5) },
            ],
          }),
          pullRequest(2, 48, { reviews: [{ author: 'carol', createdAt: at(3) }] }),
          pullRequest(3, 48),
        ],
      }),
      { now: NOW },
    );

    const { firstReview, reviewers } = report;
    assert.ok(firstReview !== null && reviewers !== null);
    assert.equal(firstReview.medianHours, 3);
    assert.equal(firstReview.p90Hours, 5);
    assert.equal(firstReview.reviewedShare, 2 / 3);
    assert.deepEqual(reviewers.top, [
      { login: 'bob', share: 0.5 },
      { login: 'carol', share: 0.5 },
    ]);
    assert.equal(reviewers.topTwoShare, 1);
  });

  it('compares the last four weeks of throughput with the eight before', () => {
    const rising = buildDeliveryReport(
      data({ weeklyMerged: [10, 10, 10, 10, 10, 10, 10, 10, 15, 15, 15, 15] }),
      { now: NOW },
    );
    const steady = buildDeliveryReport(data({ weeklyMerged: Array<number>(12).fill(8) }), {
      now: NOW,
    });

    assert.equal(rising.throughput?.trend, 'up');
    assert.equal(rising.throughput.change, 0.5);
    assert.equal(rising.throughput.perWeek, (80 + 60) / 12);
    assert.equal(steady.throughput?.trend, 'flat');
  });

  it('measures release cadence on stable releases', () => {
    const day = (days: number): Date => new Date(NOW.getTime() - days * 24 * HOUR);
    const report = buildDeliveryReport(
      data({
        releases: [
          { tag: 'v3.0.0-rc.1', publishedAt: day(1), isPrerelease: true },
          { tag: 'v2.2.0', publishedAt: day(3), isPrerelease: false },
          { tag: 'v2.1.0', publishedAt: day(10), isPrerelease: false },
          { tag: 'v2.0.0', publishedAt: day(31), isPrerelease: false },
          { tag: 'v1.0.0', publishedAt: day(200), isPrerelease: false },
        ],
      }),
      { now: NOW },
    );

    assert.equal(report.releases.inWindow, 3);
    assert.equal(report.releases.perMonth, 1);
    assert.equal(report.releases.medianIntervalDays, 21);
    assert.equal(report.releases.daysSinceLast, 3);
    // Three releases in 90 days is one a month: the medium band starts there.
    assert.equal(report.bands.releaseFrequency, 'medium');
  });

  it('groups pull requests by size and compares their merge times', () => {
    const report = buildDeliveryReport(
      data({
        sample: [
          pullRequest(1, 2, { additions: 10, deletions: 0 }),
          pullRequest(2, 4, { additions: 30, deletions: 5 }),
          pullRequest(3, 96, { additions: 900, deletions: 400 }),
        ],
      }),
      { now: NOW },
    );

    assert.deepEqual(report.sizes, [
      { bucket: 'S', count: 2, medianHours: 2 },
      { bucket: 'M', count: 0, medianHours: null },
      { bucket: 'L', count: 0, medianHours: null },
      { bucket: 'XL', count: 1, medianHours: 96 },
    ]);
    assert.equal(sizeOf({ additions: 249, deletions: 0 }), 'M');
    assert.equal(sizeOf({ additions: 999, deletions: 0 }), 'L');
  });

  it('turns reverts and abandoned pull requests into rates and bands', () => {
    const report = buildDeliveryReport(
      data({ mergedCount: 200, revertCount: 16, abandonedCount: 50, staleOpenCount: 7 }),
      { now: NOW },
    );

    assert.equal(report.revertRate, 0.08);
    assert.equal(report.bands.changeFailure, 'high');
    assert.deepEqual(report.abandonment, { closedUnmerged: 50, rate: 0.2 });
    assert.equal(report.staleOpen, 7);
  });

  it('leaves unknown what search could not count', () => {
    const report = buildDeliveryReport(
      data({ searchIndexed: false, abandonedCount: null, staleOpenCount: null }),
      { now: NOW },
    );

    assert.equal(report.searchIndexed, false);
    assert.equal(report.abandonment, null);
    assert.equal(report.staleOpen, null);
    assert.equal(report.throughput, null);
  });

  it('reports nothing it cannot measure on an inactive repository', () => {
    const report = buildDeliveryReport(data({ mergedCount: 0 }), { now: NOW });

    assert.equal(report.leadTime, null);
    assert.equal(report.firstReview, null);
    assert.equal(report.reviewers, null);
    assert.equal(report.revertRate, null);
    assert.equal(report.bands.leadTime, null);
    assert.equal(report.bands.releaseFrequency, null);
    assert.equal(report.releases.daysSinceLast, null);
  });
});
