import type { ActivityReportResponse } from './api.ts';
import { signedPercentage } from './delivery-insights.ts';
import { formatDate, percentage } from './format.ts';
import { formatNumber, interpolate, plural, type Locale, type Messages } from './i18n.ts';
import type { Insight } from './report-insights.ts';

export interface Release {
  readonly tag: string;
  readonly publishedAt: string;
}

export type ActivityWindow = ActivityReportResponse['windows'][number];
export type WindowMonths = ActivityWindow['months'];
export type ActivityWeek = ActivityReportResponse['weeks'][number];

/** Two people or fewer making half of the commits is a dependency worth flagging. */
const CONCENTRATED_PEOPLE = 2;
/** No commit by a person for this long suggests the project may be unmaintained. */
const STALE_DAYS = 90;
const BOT_SHARE = 0.3;
const WEEKEND_SHARE = 0.25;
const MAX_INSIGHTS = 4;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** The period of the report for a number of months; the report always has all three. */
export function windowOf(report: ActivityReportResponse, months: WindowMonths): ActivityWindow {
  const found = report.windows.find((period) => period.months === months);
  if (found === undefined) {
    throw new Error(`The report has no ${String(months)}-month period.`);
  }
  return found;
}

/** The verdict in one sentence, with the figures that justify it. */
export function verdictSentence(
  report: ActivityReportResponse,
  period: ActivityWindow,
  t: Messages,
  locale: Locale,
): string {
  return interpolate(t.activity.verdict[period.verdict], {
    repository: report.repository,
    months: formatNumber(period.months, locale),
    perWeek: formatNumber(Math.round(period.perWeek), locale),
    change: period.change === null ? '' : signedPercentage(period.change, locale),
  });
}

type Rule = (
  report: ActivityReportResponse,
  period: ActivityWindow,
  t: Messages,
  locale: Locale,
) => Insight | null;

const concentrationRule: Rule = (_report, period, t, locale) => {
  const { people } = period.concentration;
  if (people === null) {
    return null;
  }
  const copy = t.activity.insights;
  const months = formatNumber(period.months, locale);
  return people <= CONCENTRATED_PEOPLE
    ? {
        tone: 'warn',
        title: t.activity.concentration.title,
        text: interpolate(copy.concentrated, {
          months,
          people: plural(copy.people, people, locale),
        }),
      }
    : {
        tone: 'ok',
        title: t.activity.concentration.title,
        text: interpolate(copy.spread, { months, count: formatNumber(people, locale) }),
      };
};

const staleRule: Rule = (report, _window, t, locale) => {
  const last = report.maintenance.lastHumanWeek;
  if (last === null) {
    return null;
  }
  // The latest commit may fall on any day of its week: count from the week's end.
  const days = (Date.parse(report.generatedAt) - Date.parse(last) - WEEK_MS) / DAY_MS;
  return days > STALE_DAYS
    ? {
        tone: 'warn',
        title: t.activity.maintenance.title,
        text: interpolate(t.activity.insights.stale, { date: formatDate(last, locale) }),
      }
    : null;
};

const newcomersRule: Rule = (report, _window, t, locale) => {
  const latest = report.flow.at(-1);
  if (latest === undefined) {
    return null;
  }
  const copy = t.activity.insights;
  return latest.newcomers > 0
    ? {
        tone: 'ok',
        title: t.activity.flow.newcomers,
        text: plural(copy.newcomers, latest.newcomers, locale),
      }
    : { tone: 'info', title: t.activity.flow.newcomers, text: copy.noNewcomers };
};

const botRule: Rule = (_report, period, t, locale) =>
  period.botShare !== null && period.botShare >= BOT_SHARE
    ? {
        tone: 'info',
        title: t.activity.maintenance.bots,
        text: interpolate(t.activity.insights.bots, {
          share: percentage(period.botShare, 1, locale),
        }),
      }
    : null;

const rhythmRule: Rule = (report, _window, t, locale) => {
  const share = report.rhythm.weekendShare;
  return share !== null && share >= WEEKEND_SHARE
    ? {
        tone: 'info',
        title: t.activity.rhythm.title,
        text: interpolate(t.activity.insights.volunteers, { share: percentage(share, 1, locale) }),
      }
    : null;
};

/** The most telling first: the last rules only fill the remaining room. */
const RULES: readonly Rule[] = [concentrationRule, staleRule, newcomersRule, botRule, rhythmRule];

/** Plain-language findings of an activity report over a period. */
export function buildActivityInsights(
  report: ActivityReportResponse,
  months: WindowMonths,
  t: Messages,
  locale: Locale,
): Insight[] {
  const period = windowOf(report, months);
  return RULES.map((rule) => rule(report, period, t, locale))
    .filter((insight): insight is Insight => insight !== null)
    .slice(0, MAX_INSIGHTS);
}

/** Releases published during the week that starts at `start`. */
export function releasesIn(releases: readonly Release[], start: string): Release[] {
  const from = Date.parse(start);
  return releases.filter((release) => {
    const time = Date.parse(release.publishedAt);
    return time >= from && time < from + WEEK_MS;
  });
}

/** Four intensity levels from the quartiles of the busy days, 0 for a day without commits. */
export function heatLevels(weeks: readonly ActivityWeek[]): (count: number) => number {
  const busy = weeks
    .flatMap((week) => week.days)
    .filter((count) => count > 0)
    .sort((a, b) => a - b);
  const quartile = (fraction: number): number =>
    busy[Math.min(busy.length - 1, Math.floor(fraction * busy.length))] ?? 0;
  const limits = [quartile(0.25), quartile(0.5), quartile(0.75)];
  return (count) => (count === 0 ? 0 : 1 + limits.filter((limit) => count > limit).length);
}
