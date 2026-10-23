import type { JSX } from 'react';

import type { BranchReportResponse } from './api.ts';
import { percentage } from './format.ts';
import { interpolate } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { buildInsights } from './report-insights.ts';

/**
 * The report in plain sentences, for readers who will not scan a table: how much of
 * the repository is active, how much is protected, and which branch drifted the most.
 */
export function Insights({ report }: { readonly report: BranchReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const insights = buildInsights(report, t, locale);
  const { stale, branches } = report.totals;
  const activeShare = branches === 0 ? 1 : 1 - stale / branches;
  return (
    <section className="insights" aria-labelledby="insights-title">
      <div className="insights-header">
        <h2 id="insights-title">{t.insights.title}</h2>
        <div
          className="share-bar"
          role="img"
          aria-label={interpolate(t.insights.staleShare, {
            share: percentage(stale, branches, locale),
          })}
        >
          {/* React sets styles through the CSSOM, which the strict CSP allows. */}
          <span
            className="share-active"
            style={{ width: `${String(Math.round(activeShare * 100))}%` }}
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
