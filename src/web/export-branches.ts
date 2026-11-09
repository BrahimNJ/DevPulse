import type { BranchReportResponse } from './api.ts';
import { formatAge, formatDate, median, percentage } from './format.ts';
import { formatNumber, interpolate, type Locale, type Messages } from './i18n.ts';
import { escapeMarkdown } from './markdown.ts';

/** The branch report as a Markdown document, in the visitor's language. */
export function branchReportMarkdown(
  report: BranchReportResponse,
  t: Messages,
  locale: Locale,
): string {
  return `${[...heading(report, t, locale), '', ...summary(report, t, locale)].join('\n')}\n`;
}

function heading(report: BranchReportResponse, t: Messages, locale: Locale): readonly string[] {
  const days = formatNumber(report.staleDays, locale);
  return [
    `# ${escapeMarkdown(report.repository)} · ${t.table.label}`,
    '',
    interpolate(t.export.generated, { date: formatDate(report.generatedAt, locale) }),
    `${t.app.staleAfter} ${interpolate(t.app.days, { days })}.`,
  ];
}

/** The four figures at the top of the dashboard, with the same wording. */
function summary(report: BranchReportResponse, t: Messages, locale: Locale): readonly string[] {
  const copy = t.summary;
  const { totals } = report;
  const age = median(report.branches.map((branch) => branch.ageDays));
  const count = (value: number): string => formatNumber(value, locale);
  const defaultBranch = escapeMarkdown(report.defaultBranch ?? copy.none);
  const share = percentage(totals.protected, totals.branches, locale);
  const entry = (label: string, value: string, detail: string): string =>
    `- ${interpolate(t.export.entry, { label, value, detail })}`;
  return [
    `## ${t.export.summary}`,
    '',
    entry(
      copy.branches,
      count(totals.branches),
      interpolate(copy.defaultBranch, { name: defaultBranch }),
    ),
    entry(copy.protected, count(totals.protected), interpolate(copy.protectedShare, { share })),
    entry(
      copy.stale,
      count(totals.stale),
      interpolate(copy.staleDetail, { days: count(report.staleDays) }),
    ),
    entry(
      copy.medianAge,
      age === null ? '–' : formatAge(age, locale, t.time.today),
      copy.medianDetail,
    ),
  ];
}
