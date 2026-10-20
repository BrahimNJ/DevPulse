import { useState, type JSX } from 'react';

import type { BranchReportResponse, BranchRow } from './api.ts';
import { formatAge, formatDate } from './format.ts';
import { BranchIcon, ClockIcon, LockIcon, StarIcon } from './icons.tsx';

type Filter = 'all' | 'active' | 'stale' | 'protected';

const FILTERS: readonly { readonly id: Filter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'stale', label: 'Stale' },
  { id: 'protected', label: 'Protected' },
];

function matches(branch: BranchRow, filter: Filter, search: string): boolean {
  const byFilter =
    filter === 'all' ||
    (filter === 'stale' && branch.isStale) ||
    (filter === 'active' && !branch.isStale) ||
    (filter === 'protected' && branch.isProtected);
  return byFilter && branch.name.toLowerCase().includes(search.toLowerCase());
}

export function BranchTable({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const rows = report.branches.filter((branch) => matches(branch, filter, search.trim()));

  return (
    <section className="branches" aria-label="Branches">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter branches">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => {
                setFilter(option.id);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          className="filter-input"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Filter by name"
          aria-label="Filter branches by name"
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Last commit</th>
              <th scope="col" className="numeric">
                Age
              </th>
              <th scope="col">Author</th>
              <th scope="col">Status</th>
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
                <td className="numeric-text">{formatDate(branch.lastCommit.date)}</td>
                <td className="numeric">{formatAge(branch.ageDays)}</td>
                <td className="muted">{branch.lastCommit.author ?? '–'}</td>
                <td>
                  <Badges branch={branch} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">No branch matches this filter.</p>}
      </div>
      <p className="table-caption">
        Showing {rows.length} of {report.branches.length} branches, most recently updated first.
      </p>
    </section>
  );
}

/** Each status pairs an icon with a label, so colour never carries meaning alone. */
function Badges({ branch }: { readonly branch: BranchRow }): JSX.Element {
  return (
    <span className="badges">
      {branch.isDefault && (
        <span className="badge badge-default">
          <StarIcon />
          default
        </span>
      )}
      {branch.isProtected && (
        <span className="badge badge-protected">
          <LockIcon />
          protected
        </span>
      )}
      {branch.isStale && (
        <span className="badge badge-stale">
          <ClockIcon />
          stale
        </span>
      )}
    </span>
  );
}
