import {
  CONTRIBUTOR_LIMIT,
  type ActivityData,
  type Contributor,
  type WeekActivity,
} from '../activity/report.ts';
import { GitHubError, type GitHubClient, type Statistic } from './client.ts';

/** Waits between attempts while GitHub computes a statistic: about 8 seconds in all. */
const RETRY_DELAYS_MS = [3000, 5000];

interface CommitActivityWeek {
  readonly week: number;
  readonly total: number;
  readonly days: readonly number[];
}

interface ContributorStats {
  readonly author: { readonly login: string; readonly type?: string } | null;
  readonly total: number;
  readonly weeks: readonly { readonly w: number; readonly c: number }[];
}

type PunchCard = readonly (readonly [number, number, number])[];

/**
 * GitHub is still computing the statistics of a repository. Nothing is cached, so asking
 * again a little later succeeds once GitHub has finished.
 */
export class StatisticsPendingError extends GitHubError {
  constructor() {
    super('GitHub is still computing the statistics of this repository. Try again soon.', 202);
    this.name = 'StatisticsPendingError';
  }
}

export interface ActivityFetchOptions {
  /** Injected so that tests do not wait; resolves after `ms` milliseconds. */
  readonly wait?: (ms: number) => Promise<void>;
}

/**
 * Reads the activity of a repository from three REST statistics, in parallel, 1 core
 * point each: weekly commits over 52 weeks, the most active contributors with their
 * weekly commits, and commits by day and hour. GitHub computes them on demand and answers
 * 202 meanwhile, so each pending one is asked again, twice at most.
 *
 * The repository name is safe in a path: `parseRepository` only lets letters, digits,
 * `.`, `_` and `-` through.
 */
export async function fetchActivityData(
  client: GitHubClient,
  owner: string,
  name: string,
  options: ActivityFetchOptions = {},
): Promise<ActivityData> {
  const wait = options.wait ?? delay;
  const base = `/repos/${owner}/${name}/stats`;
  const notFound = `Repository ${owner}/${name} was not found, or the token cannot access it.`;
  const read = <T>(path: string): Promise<T | null> =>
    settled(() => client.restStatistic<T>(`${base}/${path}`, notFound), wait);

  const [activity, contributors, punchCard] = await Promise.allSettled([
    read<readonly CommitActivityWeek[]>('commit_activity'),
    read<readonly ContributorStats[]>('contributors'),
    read<PunchCard>('punch_card'),
  ]);
  // Report a missing repository before a pending statistic: retrying would not help.
  const failures = [activity, contributors, punchCard].flatMap((result) =>
    result.status === 'rejected' ? [result.reason as unknown] : [],
  );
  const missing = failures.find((error) => error instanceof GitHubError && error.status === 404);
  if (failures.length > 0) {
    throw missing ?? failures[0];
  }
  const listed = fulfilled(contributors) ?? [];
  return {
    owner,
    name,
    weeks: (fulfilled(activity) ?? []).map(toWeek),
    contributors: listed.flatMap(toContributor),
    truncated: listed.length >= CONTRIBUTOR_LIMIT,
    punchCard: toPunchCard(fulfilled(punchCard) ?? []),
  };
}

function fulfilled<T>(result: PromiseSettledResult<T | null>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

/** The statistic once computed, null for an empty repository. */
async function settled<T>(
  read: () => Promise<Statistic<T>>,
  wait: (ms: number) => Promise<void>,
): Promise<T | null> {
  for (let attempt = 0; ; attempt += 1) {
    const statistic = await read();
    if (statistic.state === 'ready') {
      return statistic.value;
    }
    if (statistic.state === 'empty') {
      return null;
    }
    const pause = RETRY_DELAYS_MS[attempt];
    if (pause === undefined) {
      throw new StatisticsPendingError();
    }
    await wait(pause);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWeek(week: CommitActivityWeek): WeekActivity {
  return {
    start: new Date(week.week * 1000),
    days: Array.from({ length: 7 }, (_, day) => week.days[day] ?? 0),
    total: week.total,
  };
}

/** Commits of deleted accounts have no author and cannot be attributed. */
function toContributor(stats: ContributorStats): Contributor[] {
  if (stats.author === null) {
    return [];
  }
  const { login, type } = stats.author;
  return [
    {
      login,
      isBot: type === 'Bot' || login.endsWith('[bot]'),
      total: stats.total,
      // Only weeks with commits: a long history is mostly empty weeks.
      weeks: stats.weeks
        .filter((week) => week.c > 0)
        .sort((a, b) => a.w - b.w)
        .map((week) => ({ start: new Date(week.w * 1000), commits: week.c })),
    },
  ];
}

function toPunchCard(cells: PunchCard): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const [day, hour, commits] of cells) {
    const row = grid[day];
    if (row !== undefined && hour >= 0 && hour < 24) {
      row[hour] = commits;
    }
  }
  return grid;
}
