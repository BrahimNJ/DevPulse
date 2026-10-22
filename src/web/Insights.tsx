import type { JSX } from 'react';

import type { BranchReportResponse } from './api.ts';
import { percentage } from './format.ts';
import { buildInsights } from './report-insights.ts';

/**
 * The report in plain sentences, for readers who will not scan a table: how much of
 * the repository is active, how much is protected, and which branch drifted the most.
 */
export function Insights({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const insights = buildInsights(report);
  const staleShare =
    report.totals.branches === 0 ? 0 : report.totals.stale / report.totals.branches;
  return (
    <section className="insights" aria-labelledby="insights-title">
      <div className="insights-header">
        <h2 id="insights-title">Insights</h2>
        <div
          className="share-bar"
          aria-label={`${percentage(report.totals.stale, report.totals.branches)} of branches are stale`}
        >
          <span
            className="share-active"
            style={{ width: `${String(Math.round((1 - staleShare) * 100))}%` }}
          />
        </div>
      </div>
      <ul className="insight-list">
        {insights.map((insight) => (
          <li key={insight.title} className={`insight insight-${insight.tone}`}>
            <strong>{insight.title}</strong>
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
