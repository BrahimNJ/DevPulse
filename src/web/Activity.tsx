import { useState, type JSX, type ReactNode } from 'react';

import {
  buildActivityInsights,
  verdictSentence,
  releasesIn,
  windowOf,
  type ActivityWeek,
  type ActivityWindow,
  type Release,
  type WindowMonths,
} from './activity-insights.ts';
import { dayMonth, FlowChart, Heatmap, PunchCard, TrendChart } from './ActivityCharts.tsx';
import type { ActivityReportResponse } from './api.ts';
import { signedPercentage } from './delivery-insights.ts';
import { formatDate, percentage } from './format.ts';
import { formatNumber, interpolate, plural } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { GrowBar } from './motion.tsx';

const WINDOWS: readonly WindowMonths[] = [3, 6, 12];
const QUARTER_WEEKS = 13;

/** The most recent complete week, which the detail panel shows first. */
function lastCompleteWeek(weeks: readonly ActivityWeek[]): number {
  const last = weeks.length - 1;
  return weeks[last]?.partial === true && last > 0 ? last - 1 : Math.max(0, last);
}

/**
 * The Activity tab: one period drives every chart, and the selected week links the
 * trend, the calendar and the detail panel. Panels are numbered in reading order, and
 * each says how to read it and what it cannot see.
 */
export function ActivityView({
  report,
  releases,
}: {
  readonly report: ActivityReportResponse;
  /** Release dates from the delivery report, marked on the trend; empty until it loads. */
  readonly releases: readonly Release[];
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity;
  const [months, setMonths] = useState<WindowMonths>(6);
  const [chosen, setChosen] = useState<number | null>(null);
  const period = windowOf(report, months);
  const windowStart = report.weeks.length - period.weeks;
  // A week left outside a narrower period gives way to the latest complete one.
  const selected =
    chosen !== null && chosen >= windowStart ? chosen : lastCompleteWeek(report.weeks);
  const week = report.weeks[selected];
  return (
    <div className="activity">
      <div className="activity-toolbar">
        <p className="report-meta">
          {interpolate(copy.meta, {
            commits: formatNumber(windowOf(report, 12).commits, locale),
            listed: formatNumber(report.limits.contributorsListed, locale),
          })}
        </p>
        <WindowSelector months={months} onChange={setMonths} />
      </div>
      {report.limits.truncated && (
        <p className="notice notice-info" role="note">
          {interpolate(copy.truncated, {
            count: formatNumber(report.limits.contributorsListed, locale),
          })}
        </p>
      )}
      <Verdict report={report} period={period} />
      {week === undefined ? null : (
        <div className="activity-trend">
          <StepPanel
            step={2}
            title={copy.trend.title}
            subtitle={copy.trend.subtitle}
            howTo={copy.trend.howTo}
            blindSpot={copy.trend.blindSpot}
          >
            <TrendChart
              weeks={report.weeks.slice(windowStart)}
              offset={windowStart}
              selected={selected}
              releases={releases}
              onSelect={setChosen}
            />
            <p className="chart-legend" aria-hidden="true">
              <span className="legend-bar" /> {copy.verdict.commits}
              <span className="legend-line" /> {copy.trend.median}
              <span className="legend-tick" /> {copy.trend.release}
            </p>
          </StepPanel>
          <WeekDetail week={week} releases={releases} />
        </div>
      )}
      {report.weeks.length > 0 && (
        <StepPanel
          step={3}
          title={copy.heatmap.title}
          subtitle={copy.heatmap.subtitle}
          howTo={copy.heatmap.howTo}
          blindSpot={copy.heatmap.blindSpot}
        >
          <Heatmap
            weeks={report.weeks}
            windowStart={windowStart}
            selected={selected}
            onSelect={setChosen}
          />
        </StepPanel>
      )}
      <div className="panel-grid">
        <Concentration report={report} period={period} />
        <Flow report={report} period={period} />
        <Rhythm report={report} />
        <Maintenance report={report} period={period} />
      </div>
      <ActivityInsights report={report} months={months} />
      <p className="methodology">
        {copy.methodology} <a href="/docs#activity-methodology">{copy.methodologyLink}</a>
      </p>
    </div>
  );
}

function WindowSelector({
  months,
  onChange,
}: {
  readonly months: WindowMonths;
  readonly onChange: (months: WindowMonths) => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{t.activity.windowLabel}</legend>
      <span className="segmented-label" aria-hidden="true">
        {t.activity.windowLabel}
      </span>
      {WINDOWS.map((option) => (
        <label key={option} className={option === months ? 'segment segment-on' : 'segment'}>
          <input
            type="radio"
            name="activity-period"
            className="visually-hidden"
            checked={option === months}
            onChange={() => {
              onChange(option);
            }}
          />
          {t.activity.windows[option]}
        </label>
      ))}
      <span className="segmented-hint">{t.activity.windowHint}</span>
    </fieldset>
  );
}

function StepPanel({
  step,
  title,
  subtitle,
  howTo,
  blindSpot,
  children,
}: {
  readonly step: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly howTo: string;
  readonly blindSpot: string;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="panel step-panel">
      <header className="panel-header">
        <h3>
          <span className="step" aria-hidden="true">
            {step}
          </span>
          {title}
        </h3>
        {subtitle !== undefined && <span className="muted">{subtitle}</span>}
      </header>
      {children}
      <dl className="reading-notes">
        <div>
          <dt>{t.activity.howTo}</dt>
          <dd>{howTo}</dd>
        </div>
        <div>
          <dt>{t.activity.blindSpot}</dt>
          <dd>{blindSpot}</dd>
        </div>
      </dl>
    </section>
  );
}

const VERDICT_TONES: Readonly<Record<ActivityWindow['verdict'], string>> = {
  growing: 'ok',
  steady: 'info',
  slowing: 'warn',
  quiet: 'muted',
  dormant: 'danger',
};

function Verdict({
  report,
  period,
}: {
  readonly report: ActivityReportResponse;
  readonly period: ActivityWindow;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.verdict;
  const unknown = t.activity.unknown;
  const figures = [
    { label: copy.commits, value: formatNumber(period.commits, locale) },
    { label: copy.perWeek, value: formatNumber(Math.round(period.perWeek), locale) },
    { label: copy.people, value: formatNumber(period.concentration.contributors, locale) },
    {
      label: copy.bots,
      value: period.botShare === null ? unknown : percentage(period.botShare, 1, locale),
    },
  ];
  return (
    <StepPanel step={1} title={copy.title} howTo={copy.howTo} blindSpot={copy.blindSpot}>
      <div className="verdict">
        <span className={`verdict-badge verdict-${VERDICT_TONES[period.verdict]}`}>
          {t.activity.verdicts[period.verdict]}
        </span>
        <p className="verdict-text">{verdictSentence(report, period, t, locale)}</p>
      </div>
      <dl className="figure-strip">
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt>{figure.label}</dt>
            <dd>{figure.value}</dd>
          </div>
        ))}
      </dl>
    </StepPanel>
  );
}

function WeekDetail({
  week,
  releases,
}: {
  readonly week: ActivityWeek;
  readonly releases: readonly Release[];
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.week;
  const max = Math.max(1, ...week.days);
  const change =
    week.rollingMedian === null || week.rollingMedian === 0 || week.partial
      ? null
      : week.commits / week.rollingMedian - 1;
  const tags = releasesIn(releases, week.start).map((release) => release.tag);
  return (
    <aside className="panel week-detail" aria-live="polite">
      <header className="panel-header">
        <h3>{interpolate(copy.title, { date: formatDate(week.start, locale) })}</h3>
      </header>
      <p className="week-commits">{plural(copy.commits, week.commits, locale)}</p>
      <p className="muted small">
        {week.partial
          ? copy.partial
          : change === null
            ? copy.noMedian
            : interpolate(copy.vsMedian, { change: signedPercentage(change, locale) })}
      </p>
      <ol className="day-bars" aria-label={t.activity.heatmap.subtitle}>
        {week.days.map((count, day) => (
          <li key={day} title={`${t.activity.rhythm.days[day] ?? ''}: ${String(count)}`}>
            <span className="day-track">
              <span className="day-fill" style={{ height: `${String((count / max) * 100)}%` }} />
            </span>
            <span className="day-label">{copy.days[day]}</span>
          </li>
        ))}
      </ol>
      <dl className="stat-list">
        <div>
          <dt>{copy.people}</dt>
          <dd>{formatNumber(week.humans, locale)}</dd>
        </div>
        <div>
          <dt>{copy.newcomers}</dt>
          <dd>{formatNumber(week.newcomers, locale)}</dd>
        </div>
        <div>
          <dt>{copy.releases}</dt>
          <dd className="mono">{tags.length === 0 ? copy.none : tags.join(', ')}</dd>
        </div>
      </dl>
    </aside>
  );
}

const SEGMENTS = 5;

function Concentration({
  report,
  period,
}: {
  readonly report: ActivityReportResponse;
  readonly period: ActivityWindow;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.concentration;
  const { people, top } = period.concentration;
  const others = Math.max(0, 1 - top.reduce((sum, person) => sum + person.share, 0));
  const compare = [
    {
      label: interpolate(copy.window, { months: formatNumber(period.months, locale) }),
      people,
    },
    { label: copy.allTime, people: report.allTime.people },
  ];
  const most = Math.max(1, ...compare.map((row) => row.people ?? 0));
  return (
    <StepPanel step={4} title={copy.title} howTo={copy.howTo} blindSpot={copy.blindSpot}>
      {people === null ? (
        <p className="muted">{copy.none}</p>
      ) : (
        <>
          <p className="panel-lead">{plural(copy.headline, people, locale)}</p>
          <div
            className="concentration-bar"
            role="img"
            aria-label={shareLabel(top, others, copy.others)}
          >
            {top.map((person, index) => (
              <span
                key={person.login}
                className={`seg seg-${String(index % SEGMENTS)}`}
                style={{ width: `${String(person.share * 100)}%` }}
              />
            ))}
            <span className="seg seg-others" style={{ width: `${String(others * 100)}%` }} />
          </div>
          <ul className="share-legend">
            {top.map((person, index) => (
              <li key={person.login}>
                <span className={`swatch seg-${String(index % SEGMENTS)}`} />
                <a className="mono" href={`https://github.com/${person.login}`}>
                  {person.login}
                </a>
                <span>{percentage(person.share, 1, locale)}</span>
              </li>
            ))}
            <li>
              <span className="swatch seg-others" />
              {copy.others}
              <span>{percentage(others, 1, locale)}</span>
            </li>
          </ul>
        </>
      )}
      <ul className="hbars">
        {compare.map((row) => (
          <li key={row.label}>
            <span className="hbar-label">{row.label}</span>
            <span className="hbar-track">
              <GrowBar className="hbar-fill hbar-alt" share={(row.people ?? 0) / most} />
            </span>
            <span className="hbar-value">
              {row.people === null ? t.activity.unknown : formatNumber(row.people, locale)}
            </span>
          </li>
        ))}
      </ul>
    </StepPanel>
  );
}

function shareLabel(
  top: ActivityWindow['concentration']['top'],
  others: number,
  othersLabel: string,
): string {
  const parts = top.map((person) => `${person.login} ${String(Math.round(person.share * 100))} %`);
  return [...parts, `${othersLabel} ${String(Math.round(others * 100))} %`].join(', ');
}

function Flow({
  report,
  period,
}: {
  readonly report: ActivityReportResponse;
  readonly period: ActivityWindow;
}): JSX.Element {
  const { t } = useI18n();
  const copy = t.activity.flow;
  const legend = [
    ['flow-new', copy.newcomers],
    ['flow-returning', copy.returning],
    ['flow-retained', copy.retained],
    ['flow-lapsed', copy.lapsed],
  ] as const;
  return (
    <StepPanel
      step={5}
      title={copy.title}
      subtitle={copy.subtitle}
      howTo={copy.howTo}
      blindSpot={copy.blindSpot}
    >
      {report.flow.length === 0 ? (
        <p className="muted">{copy.none}</p>
      ) : (
        <>
          <FlowChart flow={report.flow} highlighted={Math.ceil(period.weeks / QUARTER_WEEKS)} />
          <p className="chart-legend">
            {legend.map(([className, label]) => (
              <span key={className} className="legend-item">
                <span className={`swatch ${className}`} />
                {label}
              </span>
            ))}
          </p>
        </>
      )}
    </StepPanel>
  );
}

function Rhythm({ report }: { readonly report: ActivityReportResponse }): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.rhythm;
  const { peak, weekendShare, officeHoursShare } = report.rhythm;
  const unknown = t.activity.unknown;
  return (
    <StepPanel
      step={6}
      title={copy.title}
      subtitle={copy.subtitle}
      howTo={copy.howTo}
      blindSpot={copy.blindSpot}
    >
      {peak === null ? (
        <p className="muted">{copy.none}</p>
      ) : (
        <>
          <PunchCard punchCard={report.rhythm.punchCard} />
          <p className="panel-lead">
            {interpolate(copy.peak, {
              day: copy.days[peak.day] ?? '',
              hour: interpolate(copy.hour, { hour: peak.hour }),
            })}
          </p>
        </>
      )}
      <dl className="stat-list">
        <div>
          <dt>{copy.weekend}</dt>
          <dd>{weekendShare === null ? unknown : percentage(weekendShare, 1, locale)}</dd>
        </div>
        <div>
          <dt>{copy.office}</dt>
          <dd>{officeHoursShare === null ? unknown : percentage(officeHoursShare, 1, locale)}</dd>
        </div>
      </dl>
    </StepPanel>
  );
}

function Maintenance({
  report,
  period,
}: {
  readonly report: ActivityReportResponse;
  readonly period: ActivityWindow;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.maintenance;
  const unknown = t.activity.unknown;
  const weekOf = (iso: string | null): string =>
    iso === null ? copy.none : interpolate(copy.weekOf, { date: dayMonth(iso, locale) });
  const rows = [
    { label: copy.lastHuman, value: weekOf(report.maintenance.lastHumanWeek) },
    { label: copy.lastAny, value: weekOf(report.maintenance.lastCommitWeek) },
    {
      label: copy.bots,
      value: period.botShare === null ? unknown : percentage(period.botShare, 1, locale),
    },
    {
      label: copy.coverage,
      value: period.coverage === null ? unknown : percentage(period.coverage, 1, locale),
    },
    {
      label: copy.listed,
      value: `${formatNumber(report.limits.contributorsListed, locale)}${report.limits.truncated ? ' (max.)' : ''}`,
    },
  ];
  return (
    <StepPanel step={7} title={copy.title} howTo={copy.howTo} blindSpot={copy.blindSpot}>
      <dl className="stat-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </StepPanel>
  );
}

function ActivityInsights({
  report,
  months,
}: {
  readonly report: ActivityReportResponse;
  readonly months: WindowMonths;
}): JSX.Element | null {
  const { t, locale } = useI18n();
  const insights = buildActivityInsights(report, months, t, locale);
  if (insights.length === 0) {
    return null;
  }
  return (
    <section className="insights" aria-labelledby="activity-insights-title">
      <div className="insights-header">
        <h2 id="activity-insights-title">{t.activity.insights.title}</h2>
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
