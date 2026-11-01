/**
 * Activity of a repository and the dynamics of the people who keep it running, from the
 * statistics GitHub computes. They count commits on the default branch without merge
 * commits, and list only the most active contributors; the interface says so.
 */

/** Commits of one week, which GitHub starts on Sunday at 00:00 UTC. */
export interface WeekActivity {
  readonly start: Date;
  /** Seven counts, Sunday first. */
  readonly days: readonly number[];
  readonly total: number;
}

export interface Contributor {
  readonly login: string;
  readonly isBot: boolean;
  /** Commits over the whole history. */
  readonly total: number;
  /** The weeks with at least one commit, oldest first. */
  readonly weeks: readonly { readonly start: Date; readonly commits: number }[];
}

/** Raw activity data of a repository, as read from GitHub. */
export interface ActivityData {
  readonly owner: string;
  readonly name: string;
  /** The last 52 weeks, oldest first; empty for a repository without commits. */
  readonly weeks: readonly WeekActivity[];
  /** The most active contributors over the whole history, as many as GitHub lists. */
  readonly contributors: readonly Contributor[];
  /**
   * GitHub cut its list, deleted accounts included, so less active people are not
   * seen.
   */
  readonly truncated: boolean;
  /** Commits by day (Sunday first) and hour, in the time zone of each commit: 7 × 24. */
  readonly punchCard: readonly (readonly number[])[];
}

export type Verdict = 'growing' | 'steady' | 'slowing' | 'quiet' | 'dormant';

export type WindowMonths = 3 | 6 | 12;

export interface Concentration {
  /** The fewest people who make half of the commits; null without any commit. */
  readonly people: number | null;
  readonly contributors: number;
  /** The most active people, at most five, with their share of the commits. */
  readonly top: readonly { readonly login: string; readonly share: number }[];
}

export interface ActivityWeek {
  readonly start: Date;
  readonly commits: number;
  readonly days: readonly number[];
  /** People, bots excluded, with a commit this week, among the listed contributors. */
  readonly humans: number;
  /** People whose first commit falls in this week. */
  readonly newcomers: number;
  /** Median of the eight complete weeks ending with this one; null before eight. */
  readonly rollingMedian: number | null;
  /** The current week, still in progress: left out of every average. */
  readonly partial: boolean;
}

export interface ActivityWindow {
  readonly months: WindowMonths;
  readonly weeks: number;
  readonly commits: number;
  /** Average over the complete weeks of the window. */
  readonly perWeek: number;
  /** Second half of the window against the first: +0.25 is 25% more. */
  readonly change: number | null;
  readonly verdict: Verdict;
  readonly concentration: Concentration;
  /** Commits by bots among those attributed to listed contributors. */
  readonly botShare: number | null;
  /** Commits attributed to listed contributors, out of all commits of the window. */
  readonly coverage: number | null;
}

export interface FlowQuarter {
  /** The first week of the 13-week block. */
  readonly start: Date;
  readonly active: number;
  /** First commit ever in this block. */
  readonly newcomers: number;
  /** Active in the previous block too. */
  readonly retained: number;
  /** Back after at least a block without a commit. */
  readonly returning: number;
  /** Active in the previous block, not in this one. */
  readonly lapsed: number;
}

export interface ActivityReport {
  readonly repository: string;
  readonly generatedAt: Date;
  /** Oldest first. */
  readonly weeks: readonly ActivityWeek[];
  /** The 3, 6 and 12-month windows, in that order. */
  readonly windows: readonly ActivityWindow[];
  readonly allTime: Concentration;
  /** The last four 13-week blocks, oldest first. */
  readonly flow: readonly FlowQuarter[];
  readonly rhythm: {
    readonly punchCard: readonly (readonly number[])[];
    readonly total: number;
    readonly weekendShare: number | null;
    /** Monday to Friday, 9:00 to 18:00 in the committer's time zone. */
    readonly officeHoursShare: number | null;
    /** The busiest hour; `day` 0 is Sunday. */
    readonly peak: { readonly day: number; readonly hour: number } | null;
  };
  readonly maintenance: {
    /** The week of the latest commit by a listed person, bots excluded. */
    readonly lastHumanWeek: Date | null;
    /** The week of the latest commit of any kind over the last 52 weeks. */
    readonly lastCommitWeek: Date | null;
  };
  readonly limits: {
    readonly contributorsListed: number;
    /** GitHub cut its list, so less active people are not seen. */
    readonly truncated: boolean;
  };
}

/**
 * `stats/contributors` stops at 100 contributors, and at 500 on some very large
 * repositories (measured on expressjs/express and nodejs/node): a list this long is cut.
 */
export const CONTRIBUTOR_LIMIT = 100;
const WEEK_MS = 7 * 86_400_000;
const WINDOW_WEEKS: Readonly<Record<WindowMonths, number>> = { 3: 13, 6: 26, 12: 52 };
const QUARTER_WEEKS = 13;
const QUARTERS = 4;
const ROLLING_WEEKS = 8;
const TOP_PEOPLE = 5;
/** A change of this size between the halves of a window is growth or slowing. */
const TREND = 0.3;

export function buildActivityReport(data: ActivityData, options: { now: Date }): ActivityReport {
  const humans = data.contributors.filter((contributor) => !contributor.isBot);
  const firstWeeks = new Map(humans.map((human) => [human.login, firstWeek(human)]));
  const complete = data.weeks.map(
    (week) => week.start.getTime() + WEEK_MS <= options.now.getTime(),
  );
  const weeks = data.weeks.map((week, index): ActivityWeek => {
    const time = week.start.getTime();
    const active = humans.filter((human) => commitsIn(human, time, time + WEEK_MS) > 0);
    return {
      start: week.start,
      commits: week.total,
      days: week.days,
      humans: active.length,
      newcomers: active.filter((human) => firstWeeks.get(human.login) === time).length,
      rollingMedian: rollingMedian(data.weeks, complete, index),
      partial: complete[index] !== true,
    };
  });
  return {
    repository: `${data.owner}/${data.name}`,
    generatedAt: options.now,
    weeks,
    windows: ([3, 6, 12] as const).map((months) => activityWindow(data, weeks, months)),
    allTime: concentration(humans.map((human) => [human.login, human.total])),
    flow: flow(data.weeks, humans, firstWeeks),
    rhythm: rhythm(data.punchCard),
    maintenance: {
      lastHumanWeek: latest(humans.flatMap((human) => human.weeks.map((week) => week.start))),
      lastCommitWeek: latest(data.weeks.filter((week) => week.total > 0).map((week) => week.start)),
    },
    limits: {
      contributorsListed: data.contributors.length,
      truncated: data.truncated,
    },
  };
}

function firstWeek(contributor: Contributor): number | null {
  return contributor.weeks[0]?.start.getTime() ?? null;
}

/** Commits of a contributor in [from, to), in milliseconds. */
function commitsIn(contributor: Contributor, from: number, to: number): number {
  let commits = 0;
  for (const week of contributor.weeks) {
    const time = week.start.getTime();
    if (time >= from && time < to) {
      commits += week.commits;
    }
  }
  return commits;
}

function rollingMedian(
  weeks: readonly WeekActivity[],
  complete: readonly boolean[],
  index: number,
): number | null {
  if (complete[index] !== true || index < ROLLING_WEEKS - 1) {
    return null;
  }
  return median(weeks.slice(index - ROLLING_WEEKS + 1, index + 1).map((week) => week.total));
}

export function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return null;
  }
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function activityWindow(
  data: ActivityData,
  weeks: readonly ActivityWeek[],
  months: WindowMonths,
): ActivityWindow {
  const slice = weeks.slice(-WINDOW_WEEKS[months]);
  const complete = slice.filter((week) => !week.partial).map((week) => week.commits);
  const commits = sum(slice.map((week) => week.commits));
  const from = slice[0]?.start.getTime() ?? 0;
  const to = (slice.at(-1)?.start.getTime() ?? 0) + WEEK_MS;
  const counted = data.contributors.map(
    (contributor) => [contributor, commitsIn(contributor, from, to)] as const,
  );
  const humanCommits = counted.filter(([contributor]) => !contributor.isBot);
  const attributed = sum(counted.map(([, count]) => count));
  const botCommits = attributed - sum(humanCommits.map(([, count]) => count));
  const perWeek = average(complete) ?? 0;
  const change = halvesChange(complete);
  return {
    months,
    weeks: slice.length,
    commits,
    perWeek,
    change,
    verdict: verdict(commits, perWeek, change),
    concentration: concentration(
      humanCommits.map(([contributor, count]) => [contributor.login, count]),
    ),
    botShare: ratio(botCommits, attributed),
    coverage: commits === 0 ? null : Math.min(1, attributed / commits),
  };
}

/** The second half of the weeks against the first; null when the first is empty. */
function halvesChange(weeks: readonly number[]): number | null {
  if (weeks.length < 4) {
    return null;
  }
  const half = Math.floor(weeks.length / 2);
  const before = average(weeks.slice(0, half)) ?? 0;
  const after = average(weeks.slice(-half)) ?? 0;
  return before === 0 ? null : after / before - 1;
}

/**
 * Dormant without any commit, quiet under one a week; otherwise the change between the
 * halves of the window decides between growing, steady and slowing.
 */
export function verdict(commits: number, perWeek: number, change: number | null): Verdict {
  if (commits === 0) {
    return 'dormant';
  }
  if (perWeek < 1) {
    return 'quiet';
  }
  if (change !== null && change <= -TREND) {
    return 'slowing';
  }
  return change !== null && change >= TREND ? 'growing' : 'steady';
}

/** The fewest people reaching half of the commits, and the most active of them. */
export function concentration(counts: readonly (readonly [string, number])[]): Concentration {
  const ranked = counts
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = sum(ranked.map(([, count]) => count));
  let people: number | null = null;
  let cumulative = 0;
  for (const [index, [, count]] of ranked.entries()) {
    cumulative += count;
    if (cumulative * 2 >= total) {
      people = index + 1;
      break;
    }
  }
  return {
    people,
    contributors: ranked.length,
    top: ranked.slice(0, TOP_PEOPLE).map(([login, count]) => ({ login, share: count / total })),
  };
}

/** The last four 13-week blocks, ending with the current week. */
function flow(
  weeks: readonly WeekActivity[],
  humans: readonly Contributor[],
  firstWeeks: ReadonlyMap<string, number | null>,
): FlowQuarter[] {
  const last = weeks.at(-1);
  if (last === undefined) {
    return [];
  }
  const span = QUARTER_WEEKS * WEEK_MS;
  const end = last.start.getTime() + WEEK_MS;
  const activeIn = (from: number): Set<string> =>
    new Set(
      humans.filter((human) => commitsIn(human, from, from + span) > 0).map((human) => human.login),
    );
  const quarters = Math.min(QUARTERS, Math.ceil(weeks.length / QUARTER_WEEKS));
  return Array.from({ length: quarters }, (_, index) => {
    const from = end - (quarters - index) * span;
    const active = activeIn(from);
    const previous = activeIn(from - span);
    const newcomers = [...active].filter((login) => (firstWeeks.get(login) ?? 0) >= from);
    const retained = [...active].filter((login) => previous.has(login));
    return {
      start: new Date(from),
      active: active.size,
      newcomers: newcomers.length,
      retained: retained.length,
      returning: active.size - newcomers.length - retained.length,
      lapsed: [...previous].filter((login) => !active.has(login)).length,
    };
  });
}

function rhythm(punchCard: readonly (readonly number[])[]): ActivityReport['rhythm'] {
  const cells = punchCard.flatMap((hours, day) =>
    hours.map((count, hour) => ({ day, hour, count })),
  );
  const total = sum(cells.map((cell) => cell.count));
  const weekend = cells.filter((cell) => cell.day === 0 || cell.day === 6);
  const office = cells.filter(
    (cell) => cell.day > 0 && cell.day < 6 && cell.hour >= 9 && cell.hour < 18,
  );
  // The first busiest cell wins a tie, so the result does not depend on sorting.
  const peak = cells.reduce<(typeof cells)[number] | null>(
    (best, cell) => (cell.count > 0 && (best === null || cell.count > best.count) ? cell : best),
    null,
  );
  return {
    punchCard,
    total,
    weekendShare: ratio(sum(weekend.map((cell) => cell.count)), total),
    officeHoursShare: ratio(sum(office.map((cell) => cell.count)), total),
    peak: peak === null ? null : { day: peak.day, hour: peak.hour },
  };
}

function latest(dates: readonly Date[]): Date | null {
  let result: Date | null = null;
  for (const date of dates) {
    if (result === null || date > result) {
      result = date;
    }
  }
  return result;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}

function ratio(part: number, total: number): number | null {
  return total === 0 ? null : part / total;
}
