import type { BranchReportResponse, DeliveryReportResponse } from './api.ts';

/**
 * The example shown before a first analysis, so the workspace is never empty. Shaped on
 * a large open-source repository and labelled as illustrative in the interface; it
 * costs no request.
 */
export const DEMO_REPOSITORY = 'nodejs/node';

const GENERATED = '2026-10-23T08:00:00.000Z';

interface DemoBranch {
  readonly isDefault?: boolean;
  readonly isProtected?: boolean;
  readonly isStale?: boolean;
  readonly divergence?: { ahead: number; behind: number };
  readonly author?: string;
}

function branch(
  name: string,
  daysAgo: number,
  options: DemoBranch = {},
): BranchReportResponse['branches'][number] {
  const { author = 'nodejs-github-bot', divergence = null } = options;
  const date = new Date(Date.parse(GENERATED) - daysAgo * 86_400_000).toISOString();
  return {
    name,
    isDefault: options.isDefault ?? false,
    isProtected: options.isProtected ?? false,
    isStale: options.isStale ?? false,
    ageDays: daysAgo,
    lastCommit: { sha: '0'.repeat(40), date, author },
    divergence,
  };
}

export const DEMO_BRANCH_REPORT: BranchReportResponse = {
  repository: DEMO_REPOSITORY,
  defaultBranch: 'main',
  generatedAt: GENERATED,
  staleDays: 90,
  totals: { branches: 55, protected: 44, stale: 37 },
  branches: [
    branch('main', 0, { isDefault: true, isProtected: true, author: 'aduh95' }),
    branch('actions/update-v8-patch', 0, { divergence: { ahead: 1, behind: 3 } }),
    branch('v24.x', 1, {
      isProtected: true,
      divergence: { ahead: 4098, behind: 5628 },
      author: 'aduh95',
    }),
    branch('v24.x-staging', 1, {
      isProtected: true,
      divergence: { ahead: 4098, behind: 5628 },
      author: 'aduh95',
    }),
    branch('v22.x', 1, {
      isProtected: true,
      divergence: { ahead: 3968, behind: 8133 },
      author: 'aduh95',
    }),
    branch('v22.x-staging', 1, {
      isProtected: true,
      divergence: { ahead: 3968, behind: 8133 },
      author: 'aduh95',
    }),
    branch('v20.x', 34, {
      isProtected: true,
      divergence: { ahead: 3412, behind: 11904 },
      author: 'marco-ippolito',
    }),
    branch('canary-base', 210, {
      isProtected: true,
      isStale: true,
      divergence: { ahead: 12, behind: 6870 },
    }),
    branch('v18.x', 380, {
      isProtected: true,
      isStale: true,
      divergence: { ahead: 2876, behind: 15720 },
    }),
    branch('v0.7.4-release', 5365, {
      isStale: true,
      divergence: { ahead: 2, behind: 43712 },
      author: 'isaacs',
    }),
  ],
};

export const DEMO_DELIVERY_REPORT: DeliveryReportResponse = {
  repository: DEMO_REPOSITORY,
  generatedAt: GENERATED,
  windowDays: 90,
  searchIndexed: true,
  merged: 1078,
  leadTime: { medianHours: 91, p90Hours: 458, sampleSize: 99 },
  firstReview: { medianHours: 7, p90Hours: 62, sampleSize: 96, reviewedShare: 0.97 },
  throughput: {
    weekly: [107, 86, 82, 112, 95, 94, 66, 85, 90, 71, 54, 83],
    perWeek: 85.5,
    change: -0.18,
    trend: 'down',
  },
  releases: { inWindow: 21, perMonth: 7, medianIntervalDays: 6, daysSinceLast: 2 },
  revertRate: 0.006,
  abandonment: { closedUnmerged: 970, rate: 0.47 },
  staleOpen: 5,
  sizes: [
    { bucket: 'S', count: 57, medianHours: 70 },
    { bucket: 'M', count: 25, medianHours: 168 },
    { bucket: 'L', count: 10, medianHours: 49 },
    { bucket: 'XL', count: 7, medianHours: 53 },
  ],
  reviewers: {
    count: 41,
    topTwoShare: 0.19,
    top: [
      { login: 'lpinca', share: 0.11 },
      { login: 'jasnell', share: 0.08 },
      { login: 'aduh95', share: 0.07 },
      { login: 'RafaelGSS', share: 0.06 },
      { login: 'mcollina', share: 0.05 },
    ],
  },
  botShare: 0.01,
  bands: { leadTime: 'high', releaseFrequency: 'high', changeFailure: 'elite' },
};
