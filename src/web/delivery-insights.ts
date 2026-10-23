import type { DeliveryReportResponse } from './api.ts';
import { formatDuration, percentage } from './format.ts';
import { formatNumber, interpolate, type Locale, type Messages } from './i18n.ts';
import type { Insight } from './report-insights.ts';

/** Shares of reviews by the two most active reviewers above this are a bottleneck. */
const CONCENTRATED = 0.5;
/** Fewer pull requests than this in a size say nothing about it. */
const MIN_PER_SIZE = 3;
const MAX_INSIGHTS = 4;

type Rule = (report: DeliveryReportResponse, t: Messages, locale: Locale) => Insight | null;

function medianOf(report: DeliveryReportResponse, bucket: 'S' | 'XL'): number | null {
  const size = report.sizes.find((candidate) => candidate.bucket === bucket);
  return size !== undefined && size.count >= MIN_PER_SIZE ? size.medianHours : null;
}

/**
 * How many times longer XL pull requests take to merge than S ones, or null when the
 * sample cannot say: too few in either size, or a ratio too small to matter.
 */
export function sizeRatio(report: DeliveryReportResponse): number | null {
  const small = medianOf(report, 'S');
  const large = medianOf(report, 'XL');
  if (small === null || large === null || small <= 0) {
    return null;
  }
  const ratio = large / small;
  return ratio >= 2 ? Math.round(ratio) : null;
}

const leadTimeRule: Rule = (report, t, locale) => {
  const { leadTime, bands } = report;
  if (leadTime === null || bands.leadTime === null) {
    return null;
  }
  return {
    tone: bands.leadTime === 'elite' || bands.leadTime === 'high' ? 'ok' : 'warn',
    title: t.delivery.kpis.leadTime,
    text: interpolate(t.delivery.insights.leadTime, {
      repository: report.repository,
      median: formatDuration(leadTime.medianHours, locale),
      band: t.delivery.bands[bands.leadTime],
    }),
  };
};

const sizeRule: Rule = (report, t, locale) => {
  const ratio = sizeRatio(report);
  return ratio === null
    ? null
    : {
        tone: 'warn',
        title: t.delivery.sizes.title,
        text: interpolate(t.delivery.insights.sizeRatio, { ratio: formatNumber(ratio, locale) }),
      };
};

const reviewRule: Rule = (report, t, locale) => {
  const { reviewers } = report;
  if (reviewers === null) {
    return null;
  }
  const copy = t.delivery.insights;
  const concentrated = reviewers.topTwoShare > CONCENTRATED;
  return {
    tone: concentrated ? 'warn' : 'ok',
    title: t.delivery.reviews.title,
    text: concentrated
      ? interpolate(copy.concentrated, { share: percentage(reviewers.topTwoShare, 1, locale) })
      : interpolate(copy.spread, { count: formatNumber(reviewers.count, locale) }),
  };
};

const trendRule: Rule = (report, t, locale) => {
  const { throughput } = report;
  if (throughput === null || throughput.trend === 'flat' || throughput.change === null) {
    return null;
  }
  const up = throughput.trend === 'up';
  return {
    tone: up ? 'ok' : 'info',
    title: t.delivery.throughput.title,
    text: interpolate(up ? t.delivery.insights.trendUp : t.delivery.insights.trendDown, {
      change: signedPercentage(throughput.change, locale),
    }),
  };
};

const revertRule: Rule = (report, t, locale) =>
  report.revertRate !== null && report.bands.changeFailure === 'elite'
    ? {
        tone: 'ok',
        title: t.delivery.kpis.changeFailure,
        text: interpolate(t.delivery.insights.reverts, { rate: percentage(5, 100, locale) }),
      }
    : null;

/** The most telling first: the last rules only fill the remaining room. */
const RULES: readonly Rule[] = [leadTimeRule, sizeRule, reviewRule, trendRule, revertRule];

/** Plain-language findings of a delivery report, the most telling first. */
export function buildDeliveryInsights(
  report: DeliveryReportResponse,
  t: Messages,
  locale: Locale,
): Insight[] {
  return RULES.map((rule) => rule(report, t, locale))
    .filter((insight): insight is Insight => insight !== null)
    .slice(0, MAX_INSIGHTS);
}

/** "+46 %" or "−18 %". */
export function signedPercentage(change: number, locale: Locale): string {
  const text = percentage(Math.abs(change), 1, locale);
  return change >= 0 ? `+${text}` : `−${text}`;
}
