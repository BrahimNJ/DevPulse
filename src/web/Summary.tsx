import type { JSX } from 'react';

import type { BranchReportResponse } from './api.ts';
import { formatAge, median, percentage } from './format.ts';

interface Tile {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export function Summary({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const { totals } = report;
  const medianAge = median(report.branches.map((branch) => branch.ageDays));
  const tiles: readonly Tile[] = [
    {
      label: 'Branches',
      value: totals.branches.toLocaleString('en-GB'),
      detail: `default ${report.defaultBranch ?? 'none'}`,
    },
    {
      label: 'Protected',
      value: totals.protected.toLocaleString('en-GB'),
      detail: `${percentage(totals.protected, totals.branches)} of branches`,
    },
    {
      label: 'Stale',
      value: totals.stale.toLocaleString('en-GB'),
      detail: `no commit for ${String(report.staleDays)}+ days`,
    },
    {
      label: 'Median age',
      value: medianAge === null ? '–' : formatAge(medianAge),
      detail: 'since the last commit',
    },
  ];

  return (
    <section className="summary" aria-labelledby="summary-title">
      <h2 id="summary-title" className="repository-title">
        <a href={`https://github.com/${report.repository}`}>{report.repository}</a>
      </h2>
      <ul className="tiles">
        {tiles.map((tile) => (
          <li key={tile.label} className="tile">
            <span className="tile-label">{tile.label}</span>
            <span className="tile-value">{tile.value}</span>
            <span className="tile-detail">{tile.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
