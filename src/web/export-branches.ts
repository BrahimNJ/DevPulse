import type { BranchReportResponse } from './api.ts';
import { formatDate } from './format.ts';
import { formatNumber, interpolate, type Locale, type Messages } from './i18n.ts';
import { escapeMarkdown } from './markdown.ts';

/** The branch report as a Markdown document, in the visitor's language. */
export function branchReportMarkdown(
  report: BranchReportResponse,
  t: Messages,
  locale: Locale,
): string {
  return `${heading(report, t, locale).join('\n')}\n`;
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
