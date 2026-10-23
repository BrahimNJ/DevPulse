import type { JSX } from 'react';

import type { BranchReportResponse } from './api.ts';
import { formatAge, median, percentage } from './format.ts';
import { formatNumber, interpolate } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';

interface Tile {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export function Summary({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.summary;
  const { totals } = report;
  const medianAge = median(report.branches.map((branch) => branch.ageDays));
  const tiles: readonly Tile[] = [
    {
      label: copy.branches,
      value: formatNumber(totals.branches, locale),
      detail: interpolate(copy.defaultBranch, { name: report.defaultBranch ?? copy.none }),
    },
    {
      label: copy.protected,
      value: formatNumber(totals.protected, locale),
      detail: interpolate(copy.protectedShare, {
        share: percentage(totals.protected, totals.branches, locale),
      }),
    },
    {
      label: copy.stale,
      value: formatNumber(totals.stale, locale),
      detail: interpolate(copy.staleDetail, { days: formatNumber(report.staleDays, locale) }),
    },
    {
      label: copy.medianAge,
      value: medianAge === null ? '–' : formatAge(medianAge, locale, t.time.today),
      detail: copy.medianDetail,
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
