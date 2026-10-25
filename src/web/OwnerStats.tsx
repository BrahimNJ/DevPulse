import { m } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

import { fetchAdminStats, type AdminStatsResponse } from './api.ts';
import { percentage } from './format.ts';
import { formatNumber, interpolate, LOCALES, plural, type Locale, type Messages } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { GrowBar } from './Delivery.tsx';
import { AlertIcon } from './icons.tsx';
import { Loading } from './Loading.tsx';
import { EASE_OUT } from './motion.tsx';

type Days = 7 | 30;
type Stats = AdminStatsResponse;
type Load =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly stats: Stats };

const PERIODS: readonly Days[] = [7, 30];
/** The most events a view reads, as MAX_EVENTS in src/server/admin.ts. */
const SERVER_EVENT_LIMIT = 5000;

/** "320 ms" or "4.2 s". */
function formatMilliseconds(ms: number, locale: Locale): string {
  const seconds = ms >= 1000;
  return new Intl.NumberFormat(LOCALES[locale].tag, {
    style: 'unit',
    unit: seconds ? 'second' : 'millisecond',
    unitDisplay: 'short',
    maximumFractionDigits: seconds ? 1 : 0,
  }).format(seconds ? ms / 1000 : ms);
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALES[locale].tag, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * The owner's usage statistics (ADR 0011), shown on the owner page once signed in. The
 * API answers 404 to anyone else, so this view never renders for a visitor.
 */
export function OwnerStats(): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.admin;
  const [days, setDays] = useState<Days>(7);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  const inFlight = useRef<AbortController | null>(null);

  // Each load aborts the previous one, so a slow answer never replaces a newer view.
  const refresh = useCallback((): void => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoad({ kind: 'loading' });
    fetchAdminStats(days, controller.signal).then(
      (stats) => {
        if (!controller.signal.aborted) {
          setLoad({ kind: 'ready', stats });
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setLoad({ kind: 'error' });
        }
      },
    );
  }, [days]);

  useEffect(() => {
    refresh();
    return (): void => {
      inFlight.current?.abort();
    };
  }, [refresh]);

  return (
    <section className="section owner-stats" aria-labelledby="owner-stats-title">
      <div className="container">
        <header className="stats-header">
          <div>
            <h2 id="owner-stats-title">{copy.title}</h2>
            <p className="muted small">{copy.lede}</p>
          </div>
          <div className="stats-actions">
            <div className="segmented" role="group" aria-label={copy.period}>
              {PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={days === period}
                  onClick={() => {
                    setDays(period);
                  }}
                >
                  {copy.days[period]}
                </button>
              ))}
            </div>
            <button type="button" className="button button-ghost button-small" onClick={refresh}>
              {copy.refresh}
            </button>
          </div>
        </header>
        {load.kind === 'loading' && <Loading label={copy.loading} />}
        {load.kind === 'error' && (
          <p className="notice notice-error" role="alert">
            <AlertIcon />
            {copy.error}
          </p>
        )}
        {load.kind === 'ready' && <Dashboard stats={load.stats} t={t} locale={locale} />}
      </div>
    </section>
  );
}

interface ViewProps {
  readonly stats: Stats;
  readonly t: Messages;
  readonly locale: Locale;
}

function Dashboard({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin;
  return (
    <div className="stats">
      <p className="report-meta">
        {interpolate(copy.updated, { time: formatTime(stats.generatedAt, locale) })}
      </p>
      {stats.truncated && (
        <p className="notice notice-info" role="note">
          {interpolate(copy.truncated, { count: formatNumber(SERVER_EVENT_LIMIT, locale) })}
        </p>
      )}
      {stats.totals.analyses === 0 && (
        <p className="notice notice-info" role="note">
          {copy.empty}
        </p>
      )}
      <Indicators stats={stats} t={t} locale={locale} />
      <div className="panel-grid">
        <PerDay stats={stats} t={t} locale={locale} />
        <Outcomes stats={stats} t={t} locale={locale} />
        <Repositories stats={stats} t={t} locale={locale} />
        <Audience stats={stats} t={t} locale={locale} />
      </div>
      <Failures stats={stats} t={t} locale={locale} />
    </div>
  );
}

function Indicators({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.kpis;
  const { totals, github } = stats;
  const none = t.delivery.unknown;
  const ratio = (part: number | null): string =>
    part === null ? none : percentage(part, 1, locale);
  const cards = [
    {
      label: copy.visitors,
      value: formatNumber(totals.visitors, locale),
      detail: plural(copy.visitorsDetail, totals.allowanceReached, locale),
    },
    {
      label: copy.analyses,
      value: formatNumber(totals.analyses, locale),
      detail: interpolate(copy.analysesDetail, {
        succeeded: formatNumber(totals.succeeded, locale),
        failed: formatNumber(totals.failed, locale),
      }),
    },
    {
      label: copy.success,
      value: ratio(totals.analyses === 0 ? null : totals.succeeded / totals.analyses),
      detail: copy.successDetail,
    },
    {
      label: copy.speed,
      value: totals.medianMs === null ? none : formatMilliseconds(totals.medianMs, locale),
      detail:
        totals.p90Ms === null
          ? ''
          : interpolate(copy.speedDetail, { p90: formatMilliseconds(totals.p90Ms, locale) }),
    },
    {
      label: copy.repositories,
      value: formatNumber(totals.repositories, locale),
      detail: copy.repositoriesDetail,
    },
    { label: copy.cache, value: ratio(totals.cacheHitRate), detail: copy.cacheDetail },
    {
      label: copy.delivery,
      value: formatNumber(totals.deliveryOpened, locale),
      detail: copy.deliveryDetail,
    },
    {
      label: copy.github,
      value: github === null ? none : formatNumber(github.remaining, locale),
      detail:
        github === null
          ? copy.githubUnknown
          : interpolate(copy.githubDetail, { time: formatTime(github.resetsAt, locale) }),
    },
  ];
  return (
    <ul className="kpis">
      {cards.map((card) => (
        <li key={card.label} className="kpi spot">
          <span className="kpi-label">{card.label}</span>
          <span className="kpi-value">{card.value}</span>
          <span className="kpi-detail">{card.detail}</span>
        </li>
      ))}
    </ul>
  );
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 140;

/** Stacked bars: succeeded below, failed on top. */
function PerDay({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.perDay;
  const max = Math.max(1, ...stats.perDay.map((day) => day.succeeded + day.failed));
  const slot = CHART_WIDTH / stats.perDay.length;
  const height = (count: number): number => (count / max) * CHART_HEIGHT;
  const first = stats.perDay[0]?.date ?? '';
  const last = stats.perDay.at(-1)?.date ?? '';
  return (
    <Panel title={copy.title}>
      <svg
        className="bar-chart"
        viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT + 22)}`}
        role="img"
        aria-label={stats.perDay
          .map((day) => `${day.date}: ${String(day.succeeded)} / ${String(day.failed)}`)
          .join(', ')}
      >
        {stats.perDay.map((day, index) => {
          const ok = height(day.succeeded);
          const failed = height(day.failed);
          const x = index * slot + slot * 0.15;
          const width = slot * 0.7;
          return (
            <m.g
              key={day.date}
              className="bar-stack"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: index * 0.02 }}
            >
              <rect
                className="bar bar-recent"
                x={x}
                y={CHART_HEIGHT - ok}
                width={width}
                height={ok}
              />
              <rect
                className="bar bar-failed"
                x={x}
                y={CHART_HEIGHT - ok - failed}
                width={width}
                height={failed}
              />
            </m.g>
          );
        })}
        <text className="axis-label" x={0} y={CHART_HEIGHT + 18}>
          {first.slice(5)}
        </text>
        <text className="axis-label axis-end" x={CHART_WIDTH} y={CHART_HEIGHT + 18}>
          {last.slice(5)}
        </text>
      </svg>
      <p className="panel-footer legend">
        <span>
          <i className="swatch swatch-ok" /> {copy.succeeded}{' '}
          {formatNumber(stats.totals.succeeded, locale)}
        </span>
        <span>
          <i className="swatch swatch-failed" /> {copy.failed}{' '}
          {formatNumber(stats.totals.failed, locale)}
        </span>
      </p>
    </Panel>
  );
}

function Outcomes({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.outcomes;
  const max = Math.max(1, ...stats.outcomes.map((item) => item.count));
  return (
    <Panel title={copy.title}>
      {stats.outcomes.length === 0 ? (
        <p className="muted">{copy.none}</p>
      ) : (
        <ul className="hbars outcome-list">
          {stats.outcomes.map((item) => (
            <li key={item.outcome}>
              <span className="hbar-label">{copy.labels[item.outcome]}</span>
              <span className="hbar-track">
                <GrowBar className="hbar-fill hbar-warn" share={item.count / max} />
              </span>
              <span className="hbar-value">{formatNumber(item.count, locale)}</span>
              <small className="outcome-hint">{copy.hints[item.outcome]}</small>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Repositories({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.repositories;
  return (
    <Panel title={copy.title}>
      {stats.repositories.length === 0 ? (
        <p className="muted">{t.admin.failures.none}</p>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th scope="col">{copy.name}</th>
              <th scope="col" className="numeric">
                {copy.analyses}
              </th>
              <th scope="col" className="numeric">
                {copy.failed}
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.repositories.map((repository) => (
              <tr key={repository.name}>
                <td className="mono">
                  <a href={`/app?repo=${encodeURIComponent(repository.name)}`}>{repository.name}</a>
                </td>
                <td className="numeric">{formatNumber(repository.analyses, locale)}</td>
                <td className="numeric">{formatNumber(repository.failed, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Audience({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.audience;
  const total = Math.max(1, stats.totals.analyses);
  const row = (label: string, count: number): ReactNode => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {formatNumber(count, locale)} · {percentage(count, total, locale)}
      </dd>
    </div>
  );
  return (
    <Panel title={copy.title}>
      <dl className="stat-list">
        {row(copy.mobile, stats.devices.mobile)}
        {row(copy.desktop, stats.devices.desktop)}
        {row(copy.bot, stats.devices.bot)}
        {row(copy.fr, stats.languages.fr)}
        {row(copy.en, stats.languages.en)}
        {row(copy.other, stats.languages.other)}
      </dl>
    </Panel>
  );
}

function Failures({ stats, t, locale }: ViewProps): JSX.Element {
  const copy = t.admin.failures;
  return (
    <Panel title={copy.title}>
      {stats.failures.length === 0 ? (
        <p className="muted">{copy.none}</p>
      ) : (
        <div className="table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">{copy.when}</th>
                <th scope="col">{copy.report}</th>
                <th scope="col">{copy.repository}</th>
                <th scope="col">{copy.reason}</th>
              </tr>
            </thead>
            <tbody>
              {stats.failures.map((failure, index) => (
                <tr key={`${failure.at}-${String(index)}`}>
                  <td>{formatTime(failure.at, locale)}</td>
                  <td>{t.admin.reports[failure.report]}</td>
                  <td className="mono">{failure.repository ?? '–'}</td>
                  <td>
                    {t.admin.outcomes.labels[failure.outcome]}{' '}
                    <span className="muted">({failure.status})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Panel({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className="panel spot">
      <header className="panel-header">
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}
