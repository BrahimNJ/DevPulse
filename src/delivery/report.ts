/**
 * Delivery health of a repository, from public pull requests and releases. The
 * indicators follow DORA (DevOps Research and Assessment); from public data they are
 * proxies, which the interface states.
 */

/** A merged pull request of the sample. */
export interface MergedPullRequest {
  readonly number: number;
  readonly title: string;
  readonly createdAt: Date;
  readonly mergedAt: Date;
  readonly additions: number;
  readonly deletions: number;
  readonly author: string | null;
  readonly isBot: boolean;
  /** Logins of the first reviews, in order; may include the author. */
  readonly reviews: readonly { readonly author: string | null; readonly createdAt: Date }[];
}

export interface Release {
  readonly tag: string;
  readonly publishedAt: Date;
  readonly isPrerelease: boolean;
}

/** Raw delivery data of a repository over a window, as read from GitHub. */
export interface DeliveryData {
  readonly owner: string;
  readonly name: string;
  readonly windowDays: number;
  /**
   * Whether GitHub search indexes the repository. Some large repositories are not
   * indexed; their counts then come from the sample, and some are unknown.
   */
  readonly searchIndexed: boolean;
  /** Pull requests merged in the window; the sample holds the most recent of them. */
  readonly mergedCount: number;
  readonly sample: readonly MergedPullRequest[];
  /** Closed without being merged in the window; null when search is unavailable. */
  readonly abandonedCount: number | null;
  /** Open, and not updated for 30 days; null when search is unavailable. */
  readonly staleOpenCount: number | null;
  /** Merged in the window with "Revert" in the title. */
  readonly revertCount: number;
  /** Pull requests merged per week, oldest week first; empty when search is unavailable. */
  readonly weeklyMerged: readonly number[];
  /** Most recent first. */
  readonly releases: readonly Release[];
}

export type Band = 'elite' | 'high' | 'medium' | 'low';

export interface Distribution {
  readonly medianHours: number;
  readonly p90Hours: number;
  readonly sampleSize: number;
}

export type SizeBucket = 'S' | 'M' | 'L' | 'XL';

export interface DeliveryReport {
  readonly repository: string;
  readonly generatedAt: Date;
  readonly windowDays: number;
  readonly searchIndexed: boolean;
  readonly merged: number;
  /** Merge time of human pull requests; bots merging their own updates would skew it. */
  readonly leadTime: Distribution | null;
  /** From opening to the first review by someone other than the author. */
  readonly firstReview: (Distribution & { readonly reviewedShare: number }) | null;
  readonly throughput: {
    readonly weekly: readonly number[];
    readonly perWeek: number;
    /** Last four weeks against the eight before: +0.25 is 25% more. */
    readonly change: number | null;
    readonly trend: 'up' | 'down' | 'flat';
  } | null;
  readonly releases: {
    readonly inWindow: number;
    readonly perMonth: number;
    readonly medianIntervalDays: number | null;
    readonly daysSinceLast: number | null;
  };
  /** Reverts among merged pull requests; a proxy of the change failure rate. */
  readonly revertRate: number | null;
  readonly abandonment: { readonly closedUnmerged: number; readonly rate: number | null } | null;
  readonly staleOpen: number | null;
  readonly sizes: readonly {
    readonly bucket: SizeBucket;
    readonly count: number;
    readonly medianHours: number | null;
  }[];
  readonly reviewers: {
    readonly count: number;
    /** Share of reviews made by the two most active reviewers. */
    readonly topTwoShare: number;
    readonly top: readonly { readonly login: string; readonly share: number }[];
  } | null;
  readonly botShare: number;
  readonly bands: {
    readonly leadTime: Band | null;
    readonly releaseFrequency: Band;
    readonly changeFailure: Band | null;
  };
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Additions plus deletions below each limit; anything larger is XL. */
const SIZE_LIMITS: readonly (readonly [SizeBucket, number])[] = [
  ['S', 50],
  ['M', 250],
  ['L', 1000],
];

export function buildDeliveryReport(data: DeliveryData, options: { now: Date }): DeliveryReport {
  const humans = data.sample.filter((pullRequest) => !pullRequest.isBot);
  return {
    repository: `${data.owner}/${data.name}`,
    generatedAt: options.now,
    windowDays: data.windowDays,
    searchIndexed: data.searchIndexed,
    merged: data.mergedCount,
    leadTime: distribution(humans.map(leadHours)),
    firstReview: firstReview(humans),
    throughput: data.weeklyMerged.length === 0 ? null : throughput(data.weeklyMerged),
    releases: releases(data.releases, data.windowDays, options.now),
    revertRate: data.mergedCount === 0 ? null : data.revertCount / data.mergedCount,
    abandonment:
      data.abandonedCount === null
        ? null
        : {
            closedUnmerged: data.abandonedCount,
            rate: ratio(data.abandonedCount, data.abandonedCount + data.mergedCount),
          },
    staleOpen: data.staleOpenCount,
    sizes: sizes(humans),
    reviewers: reviewers(humans),
    botShare: ratio(data.sample.length - humans.length, data.sample.length) ?? 0,
    bands: bands(data, humans, options.now),
  };
}

function leadHours(pullRequest: MergedPullRequest): number {
  return (pullRequest.mergedAt.getTime() - pullRequest.createdAt.getTime()) / HOUR_MS;
}

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted: readonly number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function distribution(hours: readonly number[]): Distribution | null {
  if (hours.length === 0) {
    return null;
  }
  const sorted = [...hours].sort((a, b) => a - b);
  return {
    medianHours: percentile(sorted, 0.5),
    p90Hours: percentile(sorted, 0.9),
    sampleSize: sorted.length,
  };
}

function firstReview(humans: readonly MergedPullRequest[]): DeliveryReport['firstReview'] {
  const waits = humans.flatMap((pullRequest) => {
    const review = pullRequest.reviews.find(
      (candidate) => candidate.author !== null && candidate.author !== pullRequest.author,
    );
    return review === undefined
      ? []
      : [(review.createdAt.getTime() - pullRequest.createdAt.getTime()) / HOUR_MS];
  });
  const result = distribution(waits.map((hours) => Math.max(0, hours)));
  return result === null ? null : { ...result, reviewedShare: waits.length / humans.length };
}

function throughput(weekly: readonly number[]): NonNullable<DeliveryReport['throughput']> {
  const total = weekly.reduce((sum, count) => sum + count, 0);
  const recent = average(weekly.slice(-4));
  const before = average(weekly.slice(0, -4));
  const change = before === null || recent === null || before === 0 ? null : recent / before - 1;
  return {
    weekly,
    perWeek: weekly.length === 0 ? 0 : total / weekly.length,
    change,
    trend: change === null || Math.abs(change) < 0.15 ? 'flat' : change > 0 ? 'up' : 'down',
  };
}

function releases(
  all: readonly Release[],
  windowDays: number,
  now: Date,
): DeliveryReport['releases'] {
  const stable = all.filter((release) => !release.isPrerelease);
  const since = now.getTime() - windowDays * DAY_MS;
  const inWindow = stable.filter((release) => release.publishedAt.getTime() >= since);
  const times = stable.map((release) => release.publishedAt.getTime()).sort((a, b) => b - a);
  const intervals = times.slice(1).map((time, index) => ((times[index] ?? time) - time) / DAY_MS);
  const latest = times[0];
  return {
    inWindow: inWindow.length,
    perMonth: (inWindow.length / windowDays) * 30,
    medianIntervalDays:
      intervals.length === 0
        ? null
        : percentile(
            [...intervals].sort((a, b) => a - b),
            0.5,
          ),
    daysSinceLast: latest === undefined ? null : Math.floor((now.getTime() - latest) / DAY_MS),
  };
}

function sizes(humans: readonly MergedPullRequest[]): DeliveryReport['sizes'] {
  const buckets: SizeBucket[] = ['S', 'M', 'L', 'XL'];
  return buckets.map((bucket) => {
    const members = humans.filter((pullRequest) => sizeOf(pullRequest) === bucket);
    return {
      bucket,
      count: members.length,
      medianHours: distribution(members.map(leadHours))?.medianHours ?? null,
    };
  });
}

export function sizeOf(
  pullRequest: Pick<MergedPullRequest, 'additions' | 'deletions'>,
): SizeBucket {
  const lines = pullRequest.additions + pullRequest.deletions;
  return SIZE_LIMITS.find(([, limit]) => lines < limit)?.[0] ?? 'XL';
}

function reviewers(humans: readonly MergedPullRequest[]): DeliveryReport['reviewers'] {
  const counts = new Map<string, number>();
  for (const pullRequest of humans) {
    for (const review of pullRequest.reviews) {
      if (review.author !== null && review.author !== pullRequest.author) {
        counts.set(review.author, (counts.get(review.author) ?? 0) + 1);
      }
    }
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return null;
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, 5).map(([login, count]) => ({ login, share: count / total }));
  return {
    count: counts.size,
    topTwoShare: ranked.slice(0, 2).reduce((sum, [, count]) => sum + count, 0) / total,
    top,
  };
}

/**
 * Bands of the DORA research (Accelerate State of DevOps): lead time under a day is
 * elite, under a week high, under a month medium; releases daily or more are elite,
 * weekly high, monthly medium; a change failure rate up to 5% is elite, 10% high,
 * 15% medium.
 */
function bands(
  data: DeliveryData,
  humans: readonly MergedPullRequest[],
  now: Date,
): DeliveryReport['bands'] {
  const median = distribution(humans.map(leadHours))?.medianHours;
  const perMonth = releases(data.releases, data.windowDays, now).perMonth;
  const revertRate = data.mergedCount === 0 ? null : data.revertCount / data.mergedCount;
  return {
    leadTime: median === undefined ? null : band(median, [24, 24 * 7, 24 * 30]),
    // Releases per month: daily (30), weekly (30 / 7), monthly (1).
    releaseFrequency: band(-perMonth, [-30, -30 / 7, -1]),
    changeFailure: revertRate === null ? null : band(revertRate, [0.05, 0.1, 0.15]),
  };
}

/** Elite up to the first limit, high up to the second, medium up to the third. */
function band(value: number, [elite, high, medium]: readonly [number, number, number]): Band {
  if (value <= elite) {
    return 'elite';
  }
  if (value <= high) {
    return 'high';
  }
  return value <= medium ? 'medium' : 'low';
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(part: number, total: number): number | null {
  return total === 0 ? null : part / total;
}
