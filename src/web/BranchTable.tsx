import { useState, type JSX } from 'react';

import type { BranchReportResponse, BranchRow } from './api.ts';
import { formatAge, formatDate, formatDivergence } from './format.ts';
import { formatNumber, interpolate } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { BranchIcon, ClockIcon, LockIcon, StarIcon } from './icons.tsx';

type Filter = 'all' | 'active' | 'stale' | 'protected';

const FILTERS: readonly Filter[] = ['all', 'active', 'stale', 'protected'];

function matches(branch: BranchRow, filter: Filter, search: string): boolean {
  const byFilter =
    filter === 'all' ||
    (filter === 'stale' && branch.isStale) ||
    (filter === 'active' && !branch.isStale) ||
    (filter === 'protected' && branch.isProtected);
  return byFilter && branch.name.toLowerCase().includes(search.toLowerCase());
}

export function BranchTable({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.table;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const rows = report.branches.filter((branch) => matches(branch, filter, search.trim()));

  return (
    <section className="branches" aria-label={copy.label}>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label={copy.filterGroup}>
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => {
                setFilter(option);
              }}
            >
              {copy.filters[option]}
            </button>
          ))}
        </div>
        <input
          className="filter-input"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder={copy.filterPlaceholder}
          aria-label={copy.filterLabel}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{copy.columns.branch}</th>
              <th scope="col">{copy.columns.lastCommit}</th>
              <th scope="col" className="numeric">
                {copy.columns.age}
              </th>
              <th
                scope="col"
                className="numeric"
                title={interpolate(copy.columns.divergenceTitle, {
                  base: report.defaultBranch ?? t.insights.defaultBranch,
                })}
              >
                {copy.columns.divergence}
              </th>
              <th scope="col">{copy.columns.author}</th>
              <th scope="col">{copy.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((branch) => (
              <tr key={branch.name}>
                <td>
                  <span className="branch-name" title={branch.name}>
                    <BranchIcon />
                    <span className="branch-label">{branch.name}</span>
                  </span>
                </td>
                <td className="numeric-text">{formatDate(branch.lastCommit.date, locale)}</td>
                <td className="numeric">{formatAge(branch.ageDays, locale, t.time.today)}</td>
                <td className="numeric">{formatDivergence(branch.divergence, locale)}</td>
                <td className="muted">{branch.lastCommit.author ?? '–'}</td>
                <td>
                  <Badges branch={branch} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">{copy.empty}</p>}
      </div>
      <p className="table-caption">
        {interpolate(copy.caption, {
          shown: formatNumber(rows.length, locale),
          total: formatNumber(report.branches.length, locale),
        })}
      </p>
    </section>
  );
}

/** Each status pairs an icon with a label, so colour never carries meaning alone. */
function Badges({ branch }: { readonly branch: BranchRow }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className="badges">
      {branch.isDefault && (
        <span className="badge badge-default">
          <StarIcon />
          {t.table.badges.default}
        </span>
      )}
      {branch.isProtected && (
        <span className="badge badge-protected">
          <LockIcon />
          {t.table.badges.protected}
        </span>
      )}
      {branch.isStale && (
        <span className="badge badge-stale">
          <ClockIcon />
          {t.table.badges.stale}
        </span>
      )}
    </span>
  );
}
