import type { BranchReportResponse, BranchRow } from './api.ts';
import { formatAge, percentage } from './format.ts';

export interface Insight {
  readonly tone: 'ok' | 'warn' | 'info';
  readonly title: string;
  readonly text: string;
}

/** Plain-language findings of a report, for readers who will not scan a table. */
export function buildInsights(report: BranchReportResponse): Insight[] {
  const { totals, branches } = report;
  if (totals.branches === 0) {
    return [{ tone: 'info', title: 'No branches', text: 'This repository has no branch yet.' }];
  }
  const insights: Insight[] = [
    totals.stale === 0
      ? {
          tone: 'ok',
          title: 'No abandoned work',
          text: `Every branch received a commit in the last ${String(report.staleDays)} days.`,
        }
      : {
          tone: totals.stale / totals.branches > 0.5 ? 'warn' : 'info',
          title: `${percentage(totals.stale, totals.branches)} of branches look abandoned`,
          text: `${String(totals.stale)} of ${String(totals.branches)} branches have had no commit for ${String(report.staleDays)} days or more.`,
        },
    totals.protected === 0
      ? {
          tone: 'warn',
          title: 'Nothing is protected',
          text: 'No branch has a protection rule, not even the default branch.',
        }
      : {
          tone: 'ok',
          title: `${String(totals.protected)} protected ${totals.protected === 1 ? 'branch' : 'branches'}`,
          text: 'Protection rules or rulesets guard them against force pushes and unreviewed changes.',
        },
  ];
  const behind = mostBehind(branches);
  if (behind !== null && behind.divergence !== null) {
    insights.push({
      tone: behind.divergence.behind > 100 ? 'warn' : 'info',
      title: `${behind.name} is the furthest behind`,
      text: `${String(behind.divergence.behind)} commits behind ${report.defaultBranch ?? 'the default branch'}, last commit: ${formatAge(behind.ageDays)}.`,
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
