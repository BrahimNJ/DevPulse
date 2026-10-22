/**
 * The product catalogue shown on the landing page. Only `available` entries exist in
 * the code; `planned` entries are proposals from the roadmap, not commitments, and
 * the page labels them as such (AGENTS.md: undefined features are marked as proposed).
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

export interface Feature {
  readonly title: string;
  readonly description: string;
  readonly icon: FeatureIcon;
  readonly status: FeatureStatus;
}

export interface FeatureGroup {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly features: readonly Feature[];
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    id: 'branches',
    name: 'Branch health',
    summary: 'Know which work is alive, protected or abandoned.',
    features: [
      {
        title: 'Branch overview',
        description: 'Every branch with its last commit, author and age, newest first.',
        icon: 'branch',
        status: 'available',
      },
      {
        title: 'Stale detection',
        description: 'Flags branches without a commit for 30 to 365 days.',
        icon: 'clock',
        status: 'available',
      },
      {
        title: 'Protection status',
        description: 'Classic protection rules and rulesets, without admin rights.',
        icon: 'lock',
        status: 'available',
      },
      {
        title: 'Branch divergence',
        description: 'How far each branch is ahead of or behind the default branch.',
        icon: 'diverge',
        status: 'available',
      },
      {
        title: 'CLI and JSON',
        description: 'The same report in a terminal, or as JSON for scripts and CI.',
        icon: 'terminal',
        status: 'available',
      },
    ],
  },
  {
    id: 'activity',
    name: 'Activity',
    summary: 'See how a repository moves over time.',
    features: [
      {
        title: 'Commit heatmap',
        description: 'Commits by day and hour, to reveal the rhythm of a project.',
        icon: 'calendar',
        status: 'planned',
      },
      {
        title: 'Activity trends',
        description: 'Weekly commits and active branches, with the change over time.',
        icon: 'activity',
        status: 'planned',
      },
    ],
  },
  {
    id: 'contributors',
    name: 'Contributors',
    summary: 'Understand who keeps the project running.',
    features: [
      {
        title: 'Top contributors',
        description: 'Who commits, reviews and merges, over a chosen period.',
        icon: 'users',
        status: 'planned',
      },
      {
        title: 'Bus factor',
        description: 'How many people the project depends on to keep moving.',
        icon: 'shield',
        status: 'planned',
      },
      {
        title: 'New and returning',
        description: 'First-time contributors versus regulars, period by period.',
        icon: 'sparkle',
        status: 'planned',
      },
    ],
  },
  {
    id: 'collaboration',
    name: 'Pull requests and issues',
    summary: 'Measure how fast work flows from idea to main.',
    features: [
      {
        title: 'Time to merge',
        description: 'From opening to merge, with medians and outliers.',
        icon: 'merge',
        status: 'planned',
      },
      {
        title: 'Review latency',
        description: 'How long a pull request waits for its first review.',
        icon: 'eye',
        status: 'planned',
      },
      {
        title: 'Ageing pull requests',
        description: 'Open pull requests that have gone quiet, oldest first.',
        icon: 'hourglass',
        status: 'planned',
      },
      {
        title: 'Issue response time',
        description: 'Time to the first answer on a new issue.',
        icon: 'message',
        status: 'planned',
      },
    ],
  },
  {
    id: 'insights',
    name: 'Insights',
    summary: 'Turn the numbers into a decision.',
    features: [
      {
        title: 'Health score',
        description: 'One score that combines activity, ownership and review flow.',
        icon: 'gauge',
        status: 'planned',
      },
      {
        title: 'Repository comparison',
        description: 'Two repositories side by side, metric by metric.',
        icon: 'compare',
        status: 'planned',
      },
      {
        title: 'Report export',
        description: 'Download a report as CSV or Markdown to share it.',
        icon: 'download',
        status: 'planned',
      },
    ],
  },
];

export function countByStatus(status: FeatureStatus): number {
  return FEATURE_GROUPS.flatMap((group) => group.features).filter(
    (feature) => feature.status === status,
  ).length;
}
