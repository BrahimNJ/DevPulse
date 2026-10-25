import { m } from 'motion/react';
import type { JSX } from 'react';

import type { DeliveryReportResponse } from './api.ts';
import { buildDeliveryInsights, signedPercentage, sizeRatio } from './delivery-insights.ts';
import { formatDuration, percentage } from './format.ts';
import { formatNumber, interpolate, plural } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { EASE_OUT, GrowBar } from './motion.tsx';

type Band = 'elite' | 'high' | 'medium' | 'low';

/** The most merged pull requests the server reads as a sample (src/github/delivery.ts). */
const SAMPLE_LIMIT = 100;

/** The Delivery tab: DORA-style indicators, throughput, sizes, reviews and flow. */
export function DeliveryView({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery;
  const sample = report.leadTime?.sampleSize ?? 0;
  // Without search the count is the sample's, capped by the query: a full sample is a floor.
  const capped = !report.searchIndexed && report.merged >= SAMPLE_LIMIT;
  return (
    <div className="delivery">
      <p className="report-meta">
        {interpolate(copy.window, {
          days: formatNumber(report.windowDays, locale),
          merged: `${formatNumber(report.merged, locale)}${capped ? '+' : ''}`,
          sample: formatNumber(sample, locale),
        })}
      </p>
      {!report.searchIndexed && (
        <p className="notice notice-info" role="note">
          {interpolate(copy.notIndexed, { sample: formatNumber(sample, locale) })}
        </p>
      )}
      <Indicators report={report} />
      <div className="panel-grid">
        <Throughput report={report} />
        <Sizes report={report} />
        <Reviewers report={report} />
        <Flow report={report} />
      </div>
      <DeliveryInsights report={report} />
      <p className="methodology">
        {copy.methodology} <a href="/docs#methodology">{copy.methodologyLink}</a>
      </p>
    </div>
  );
}

function BandBadge({ band }: { readonly band: Band | null }): JSX.Element | null {
  const { t } = useI18n();
  if (band === null) {
    return null;
  }
  // The level is written, so colour never carries the meaning alone.
  return (
    <span className={`band band-${band}`} title={t.delivery.bandTitle}>
      {t.delivery.bands[band]}
    </span>
  );
}

function Indicators({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery.kpis;
  const unknown = t.delivery.unknown;
  const { leadTime, firstReview, releases, revertRate, bands } = report;
  const cards = [
    {
      label: copy.leadTime,
      value: leadTime === null ? unknown : formatDuration(leadTime.medianHours, locale),
      detail:
        leadTime === null
          ? ''
          : interpolate(copy.leadTimeDetail, { p90: formatDuration(leadTime.p90Hours, locale) }),
      band: bands.leadTime,
    },
    {
      label: copy.releases,
      value: interpolate(copy.releasesValue, {
        count: formatNumber(Math.round(releases.perMonth * 10) / 10, locale),
      }),
      detail:
        releases.daysSinceLast === null
          ? copy.releasesNone
          : interpolate(copy.releasesDetail, {
              age: formatDuration(releases.daysSinceLast * 24, locale),
            }),
      band: bands.releaseFrequency,
    },
    {
      label: copy.changeFailure,
      value: revertRate === null ? unknown : percentage(revertRate, 1, locale),
      detail: copy.changeFailureDetail,
      band: bands.changeFailure,
    },
    {
      label: copy.firstReview,
      value: firstReview === null ? unknown : formatDuration(firstReview.medianHours, locale),
      detail:
        firstReview === null
          ? ''
          : interpolate(copy.firstReviewDetail, {
              share: percentage(firstReview.reviewedShare, 1, locale),
            }),
      band: null,
    },
  ] as const;
  return (
    <ul className="kpis">
      {cards.map((card) => (
        <li key={card.label} className="kpi spot">
          <span className="kpi-label">{card.label}</span>
          <span className="kpi-value">{card.value}</span>
          <span className="kpi-detail">{card.detail}</span>
          <BandBadge band={card.band} />
        </li>
      ))}
    </ul>
  );
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 140;

function Throughput({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery.throughput;
  const { throughput } = report;
  if (throughput === null) {
    return (
      <Panel title={copy.title} subtitle={copy.subtitle}>
        <p className="muted">{copy.unavailable}</p>
      </Panel>
    );
  }
  const max = Math.max(1, ...throughput.weekly);
  const slot = CHART_WIDTH / throughput.weekly.length;
  const trend =
    throughput.trend === 'flat' || throughput.change === null
      ? copy.flat
      : interpolate(throughput.trend === 'up' ? copy.up : copy.down, {
          change: signedPercentage(throughput.change, locale).replace(/^\+/, ''),
        });
  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <svg
        className="bar-chart"
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT + 22)}`}
        role="img"
        aria-label={`${copy.subtitle}: ${throughput.weekly.map((count) => formatNumber(count, locale)).join(', ')}`}
      >
        {throughput.weekly.map((count, index) => {
          const height = (count / max) * CHART_HEIGHT;
          const recent = index >= throughput.weekly.length - 4;
          return (
            <g key={index}>
              <m.rect
                className={recent ? 'bar bar-recent' : 'bar'}
                x={index * slot + slot * 0.18}
                y={CHART_HEIGHT - height}
                width={slot * 0.64}
                height={Math.max(1, height)}
                rx={3}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: index * 0.035 }}
              />
              <text className="bar-value" x={index * slot + slot / 2} y={CHART_HEIGHT - height - 4}>
                {formatNumber(count, locale)}
              </text>
            </g>
          );
        })}
        <text className="axis-label" x={0} y={CHART_HEIGHT + 18}>
          {interpolate(copy.weeksAgo, { weeks: throughput.weekly.length })}
        </text>
        <text className="axis-label axis-end" x={CHART_WIDTH} y={CHART_HEIGHT + 18}>
          {copy.thisWeek}
        </text>
      </svg>
      <p className="panel-footer">
        <strong className={`trend trend-${throughput.trend}`}>{trend}</strong>
        <span className="muted">
          {interpolate(copy.perWeek, {
            count: formatNumber(Math.round(throughput.perWeek), locale),
          })}
        </span>
      </p>
    </Panel>
  );
}

function Sizes({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery.sizes;
  const max = Math.max(1, ...report.sizes.map((size) => size.medianHours ?? 0));
  const ratio = sizeRatio(report);
  return (
    <Panel title={copy.title} subtitle={copy.subtitle}>
      <ul className="hbars">
        {report.sizes.map((size) => (
          <li key={size.bucket}>
            <span className="hbar-label mono">{size.bucket}</span>
            <span className="hbar-track">
              <GrowBar className="hbar-fill" share={(size.medianHours ?? 0) / max} />
            </span>
            <span className="hbar-value">
              {size.medianHours === null ? copy.none : formatDuration(size.medianHours, locale)}
              <small>{plural(copy.count, size.count, locale)}</small>
            </span>
          </li>
        ))}
      </ul>
      {ratio !== null && (
        <p className="panel-footer">
          <strong>{interpolate(copy.ratio, { ratio: formatNumber(ratio, locale) })}</strong>
        </p>
      )}
    </Panel>
  );
}

function Reviewers({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery.reviews;
  const { reviewers } = report;
  if (reviewers === null) {
    return (
      <Panel title={copy.title}>
        <p className="muted">{copy.none}</p>
      </Panel>
    );
  }
  const max = Math.max(...reviewers.top.map((reviewer) => reviewer.share));
  return (
    <Panel title={copy.title} subtitle={plural(copy.reviewers, reviewers.count, locale)}>
      <ul className="hbars">
        {reviewers.top.map((reviewer) => (
          <li key={reviewer.login}>
            <a className="hbar-label mono" href={`https://github.com/${reviewer.login}`}>
              {reviewer.login}
            </a>
            <span className="hbar-track">
              <GrowBar className="hbar-fill hbar-alt" share={reviewer.share / max} />
            </span>
            <span className="hbar-value">{percentage(reviewer.share, 1, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="panel-footer">
        <strong className={reviewers.topTwoShare > 0.5 ? 'trend trend-down' : ''}>
          {interpolate(copy.topTwo, { share: percentage(reviewers.topTwoShare, 1, locale) })}
        </strong>
      </p>
    </Panel>
  );
}

function Flow({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.delivery.flow;
  const unknown = t.delivery.unknown;
  const rows = [
    {
      label: copy.abandoned,
      value:
        report.abandonment === null
          ? unknown
          : `${formatNumber(report.abandonment.closedUnmerged, locale)}${
              report.abandonment.rate === null
                ? ''
                : ` · ${percentage(report.abandonment.rate, 1, locale)}`
            }`,
    },
    {
      label: copy.stale,
      value: report.staleOpen === null ? unknown : formatNumber(report.staleOpen, locale),
    },
    { label: copy.bots, value: percentage(report.botShare, 1, locale) },
  ];
  return (
    <Panel title={copy.title}>
      <dl className="stat-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function DeliveryInsights({ report }: { readonly report: DeliveryReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const insights = buildDeliveryInsights(report, t, locale);
  return (
    <section className="insights" aria-labelledby="delivery-insights-title">
      <div className="insights-header">
        <h2 id="delivery-insights-title">{t.delivery.insights.title}</h2>
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

function Panel({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: JSX.Element | (JSX.Element | false)[] | JSX.Element[];
}): JSX.Element {
  return (
    <section className="panel spot">
      <header className="panel-header">
        <h3>{title}</h3>
        {subtitle !== undefined && <span className="muted">{subtitle}</span>}
      </header>
      {children}
    </section>
  );
}
