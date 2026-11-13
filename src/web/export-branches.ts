import type { BranchReportResponse, BranchRow } from './api.ts';
import { csvDocument } from './csv.ts';
import { formatAge, formatDate, formatDivergence, median, percentage } from './format.ts';
import { formatNumber, interpolate, type Locale, type Messages } from './i18n.ts';
import { escapeMarkdown, markdownTable } from './markdown.ts';

/** The branch report as a Markdown document, in the visitor's language. */
export function branchReportMarkdown(
  report: BranchReportResponse,
  t: Messages,
  locale: Locale,
): string {
  const sections = [
    heading(report, t, locale),
    summary(report, t, locale),
    table(report, t, locale),
  ];
  return `${sections.map((lines) => lines.join('\n')).join('\n\n')}\n`;
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

/** Every branch, whatever the filter on screen, in the order of the report. */
function table(report: BranchReportResponse, t: Messages, locale: Locale): readonly string[] {
  const { columns } = t.table;
  const title = `## ${t.table.label}`;
  if (report.branches.length === 0) {
    return [title, '', t.insights.noBranches.text];
  }
  const rows = report.branches.map((branch) => [
    branch.name,
    formatDate(branch.lastCommit.date, locale),
    formatAge(branch.ageDays, locale, t.time.today),
    formatDivergence(branch.divergence, locale),
    branch.lastCommit.author ?? '–',
    statusOf(branch, t),
  ]);
  return [
    title,
    '',
    markdownTable(
      [
        { title: columns.branch },
        { title: columns.lastCommit },
        { title: columns.age, numeric: true },
        { title: columns.divergence, numeric: true },
        { title: columns.author },
        { title: columns.status },
      ],
      rows,
    ),
  ];
}

function statusOf(branch: BranchRow, t: Messages): string {
  const { badges } = t.table;
  return [
    branch.isDefault ? badges.default : null,
    branch.isProtected ? badges.protected : null,
    branch.isStale ? badges.stale : null,
  ]
    .filter((badge) => badge !== null)
    .join(', ');
}

/**
 * The branches as CSV for a spreadsheet: raw values under stable English headers, so
 * that dates sort and numbers add up whatever the language of the dashboard.
 */
export function branchReportCsv(report: BranchReportResponse): string {
  return csvDocument(
    [
      'branch',
      'last_commit',
      'age_days',
      'ahead',
      'behind',
      'author',
      'default',
      'protected',
      'stale',
    ],
    report.branches.map((branch) => [
      branch.name,
      branch.lastCommit.date,
      branch.ageDays,
      branch.divergence?.ahead ?? null,
      branch.divergence?.behind ?? null,
      branch.lastCommit.author,
      branch.isDefault,
      branch.isProtected,
      branch.isStale,
    ]),
  );
}
