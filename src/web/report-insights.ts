import type { BranchReportResponse, BranchRow } from './api.ts';
import { formatAge, percentage } from './format.ts';
import { formatNumber, interpolate, plural, type Locale, type Messages } from './i18n.ts';

export interface Insight {
  readonly tone: 'ok' | 'warn' | 'info';
  readonly title: string;
  readonly text: string;
}

/** Plain-language findings of a report, for readers who will not scan a table. */
export function buildInsights(
  report: BranchReportResponse,
  t: Messages,
  locale: Locale,
): Insight[] {
  const { totals, branches } = report;
  const copy = t.insights;
  if (totals.branches === 0) {
    return [{ tone: 'info', ...copy.noBranches }];
  }
  const days = formatNumber(report.staleDays, locale);
  const insights: Insight[] = [
    totals.stale === 0
      ? { tone: 'ok', title: copy.noStale.title, text: interpolate(copy.noStale.text, { days }) }
      : {
          tone: totals.stale / totals.branches > 0.5 ? 'warn' : 'info',
          title: interpolate(copy.stale.title, {
            share: percentage(totals.stale, totals.branches, locale),
          }),
          text: interpolate(copy.stale.text, {
            stale: formatNumber(totals.stale, locale),
            total: formatNumber(totals.branches, locale),
            days,
          }),
        },
    totals.protected === 0
      ? { tone: 'warn', ...copy.noProtection }
      : {
          tone: 'ok',
          title: plural(copy.protected.title, totals.protected, locale),
          text: copy.protected.text,
        },
  ];
  const behind = mostBehind(branches);
  if (behind !== null && behind.divergence !== null) {
    insights.push({
      tone: behind.divergence.behind > 100 ? 'warn' : 'info',
      title: interpolate(copy.behind.title, { name: behind.name }),
      text: interpolate(copy.behind.text, {
        behind: formatNumber(behind.divergence.behind, locale),
        base: report.defaultBranch ?? copy.defaultBranch,
        age: formatAge(behind.ageDays, locale, t.time.today),
      }),
    });
  }
  return insights;
}

function mostBehind(branches: readonly BranchRow[]): BranchRow | null {
  let worst: BranchRow | null = null;
  for (const branch of branches) {
    if (branch.divergence !== null && branch.divergence.behind > (worst?.divergence?.behind ?? 0)) {
      worst = branch;
    }
  }
  return worst;
}
