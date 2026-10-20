import type { BranchReport, BranchSummary } from '../branches/report.ts';

/** The report as JSON; dates are serialised as ISO 8601 strings. */
export function formatJson(report: BranchReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

const COLUMNS = ['BRANCH', 'LAST COMMIT', 'AGE', 'AUTHOR', 'FLAGS'] as const;

/** The report as a human-readable summary followed by an aligned table. */
export function formatTable(report: BranchReport): string {
  const { totals } = report;
  const header = [
    `${report.repository}: ${String(totals.branches)} branches, default ${report.defaultBranch ?? 'none'}`,
    `Protected: ${String(totals.protected)}. Stale (no commit for ${String(report.staleDays)}+ days): ${String(totals.stale)}.`,
  ];
  if (report.branches.length === 0) {
    return `${header.join('\n')}\n`;
  }

  const rows = report.branches.map(toRow);
  const widths = COLUMNS.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const lines = [COLUMNS, ...rows].map((cells) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join('  ')
      .trimEnd(),
  );

  return `${[...header, '', ...lines].join('\n')}\n`;
}

function toRow(branch: BranchSummary): string[] {
  const flags = [
    branch.isDefault ? 'default' : null,
    branch.isProtected ? 'protected' : null,
    branch.isStale ? 'stale' : null,
  ].filter((flag) => flag !== null);

  return [
    branch.name,
    branch.lastCommit.date.toISOString().slice(0, 10),
    `${String(branch.ageDays)}d`,
    branch.lastCommit.author ?? '-',
    flags.join(', '),
  ];
}
