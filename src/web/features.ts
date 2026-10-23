/**
 * The product catalogue shown on the landing page. Only `available` entries exist in
 * the code; `planned` entries are proposals from the roadmap, not commitments, and
 * the page labels them as such (AGENTS.md: undefined features are marked as proposed).
 * Names and descriptions are in the language files, under `catalogue`.
 */
export type FeatureStatus = 'available' | 'planned';

export type FeatureIcon =
  | 'branch'
  | 'clock'
  | 'lock'
  | 'terminal'
  | 'activity'
  | 'calendar'
  | 'diverge'
  | 'users'
  | 'shield'
  | 'sparkle'
  | 'merge'
  | 'eye'
  | 'hourglass'
  | 'message'
  | 'gauge'
  | 'compare'
  | 'download';

export type GroupId = 'branches' | 'activity' | 'contributors' | 'collaboration' | 'insights';

export type FeatureId =
  | 'branch-overview'
  | 'stale-detection'
  | 'protection-status'
  | 'branch-divergence'
  | 'cli-json'
  | 'commit-heatmap'
  | 'activity-trends'
  | 'top-contributors'
  | 'bus-factor'
  | 'new-returning'
  | 'time-to-merge'
  | 'review-latency'
  | 'ageing-pull-requests'
  | 'issue-response'
  | 'health-score'
  | 'repository-comparison'
  | 'report-export';

export interface Feature {
  readonly id: FeatureId;
  readonly icon: FeatureIcon;
  readonly status: FeatureStatus;
}

export interface FeatureGroup {
  readonly id: GroupId;
  readonly features: readonly Feature[];
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    id: 'branches',
    features: [
      { id: 'branch-overview', icon: 'branch', status: 'available' },
      { id: 'stale-detection', icon: 'clock', status: 'available' },
      { id: 'protection-status', icon: 'lock', status: 'available' },
      { id: 'branch-divergence', icon: 'diverge', status: 'available' },
      { id: 'cli-json', icon: 'terminal', status: 'available' },
    ],
  },
  {
    id: 'activity',
    features: [
      { id: 'commit-heatmap', icon: 'calendar', status: 'planned' },
      { id: 'activity-trends', icon: 'activity', status: 'planned' },
    ],
  },
  {
    id: 'contributors',
    features: [
      { id: 'top-contributors', icon: 'users', status: 'planned' },
      { id: 'bus-factor', icon: 'shield', status: 'planned' },
      { id: 'new-returning', icon: 'sparkle', status: 'planned' },
    ],
  },
  {
    id: 'collaboration',
    features: [
      { id: 'time-to-merge', icon: 'merge', status: 'planned' },
      { id: 'review-latency', icon: 'eye', status: 'planned' },
      { id: 'ageing-pull-requests', icon: 'hourglass', status: 'planned' },
      { id: 'issue-response', icon: 'message', status: 'planned' },
    ],
  },
  {
    id: 'insights',
    features: [
      { id: 'health-score', icon: 'gauge', status: 'planned' },
      { id: 'repository-comparison', icon: 'compare', status: 'planned' },
      { id: 'report-export', icon: 'download', status: 'planned' },
    ],
  },
];

export function countByStatus(status: FeatureStatus): number {
  return FEATURE_GROUPS.flatMap((group) => group.features).filter(
    (feature) => feature.status === status,
  ).length;
}
