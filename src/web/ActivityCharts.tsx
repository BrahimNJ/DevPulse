import { m } from 'motion/react';
import type { JSX, KeyboardEvent } from 'react';

import { heatLevels, releasesIn, type ActivityWeek, type Release } from './activity-insights.ts';
import type { ActivityReportResponse } from './api.ts';
import { formatNumber, interpolate, LOCALES, type Locale } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { EASE_OUT } from './motion.tsx';

/** The charts of the Activity tab, hand-written SVG on the tokens of ADR 0012. */

/** "19 Oct" or "19 oct.", in UTC like GitHub's weeks. */
export function dayMonth(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALES[locale].tag, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/** Enter and Space act as a click on an SVG element given the button role. */
function onActivate(select: () => void): (event: KeyboardEvent<SVGGElement>) => void {
  return (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select();
    }
  };
}

const TREND_WIDTH = 640;
const TREND_HEIGHT = 170;
const TREND_TOP = 18;

/** The SVG path of the rolling median, broken where a week has none. */
function medianPath(
  weeks: readonly ActivityWeek[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let path = '';
  let drawing = false;
  for (const [index, week] of weeks.entries()) {
    if (week.rollingMedian === null) {
      drawing = false;
      continue;
    }
    path += `${drawing ? 'L' : 'M'}${x(index).toFixed(1)},${y(week.rollingMedian).toFixed(1)}`;
    drawing = true;
  }
  return path;
}

/**
 * Weekly commits of the window, with the 8-week median and release ticks. Every bar is
 * a button that selects its week, which the heatmap and the detail panel follow.
 */
export function TrendChart({
  weeks,
  offset,
  selected,
  releases,
  onSelect,
}: {
  readonly weeks: readonly ActivityWeek[];
  /** Index of the first week of the window in the report. */
  readonly offset: number;
  readonly selected: number;
  readonly releases: readonly Release[];
  readonly onSelect: (index: number) => void;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.trend;
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.commits, week.rollingMedian ?? 0)));
  const slot = TREND_WIDTH / Math.max(1, weeks.length);
  const x = (index: number): number => index * slot + slot / 2;
  const y = (value: number): number => TREND_TOP + TREND_HEIGHT - (value / max) * TREND_HEIGHT;
  const first = weeks[0];
  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${String(TREND_WIDTH)} ${String(TREND_TOP + TREND_HEIGHT + 22)}`}
      role="group"
      aria-label={copy.subtitle}
    >
      <line className="trend-base" x1={0} x2={TREND_WIDTH} y1={y(0)} y2={y(0)} />
      {weeks.map((week, index) => {
        const height = (week.commits / max) * TREND_HEIGHT;
        const isSelected = offset + index === selected;
        const label = interpolate(copy.bar, {
          date: dayMonth(week.start, locale),
          commits: formatNumber(week.commits, locale),
        });
        const select = (): void => {
          onSelect(offset + index);
        };
        return (
          <g
            key={week.start}
            className="trend-week"
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={week.partial ? `${label} (${copy.partial})` : label}
            onClick={select}
            onKeyDown={onActivate(select)}
          >
            <rect className="trend-hit" x={index * slot} y={0} width={slot} height={y(0)} />
            <m.rect
              className={`bar${isSelected ? ' bar-selected' : ''}${week.partial ? ' bar-partial' : ''}`}
              x={index * slot + slot * 0.16}
              y={y(0) - height}
              width={slot * 0.68}
              height={Math.max(1, height)}
              rx={2}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: index * 0.012 }}
            />
            {releasesIn(releases, week.start).length > 0 && (
              <path className="release-tick" d={`M${String(x(index))},2 l4,7 l-8,0 z`}>
                <title>
                  {`${copy.release}: ${releasesIn(releases, week.start)
                    .map((release) => release.tag)
                    .join(', ')}`}
                </title>
              </path>
            )}
          </g>
        );
      })}
      <path className="median-line" d={medianPath(weeks, x, y)} aria-hidden="true" />
      <text className="axis-label" x={0} y={TREND_TOP + TREND_HEIGHT + 18}>
        {first === undefined ? '' : dayMonth(first.start, locale)}
      </text>
      <text className="axis-label axis-end" x={TREND_WIDTH} y={TREND_TOP + TREND_HEIGHT + 18}>
        {t.delivery.throughput.thisWeek}
      </text>
      <text className="axis-label axis-end" x={TREND_WIDTH} y={TREND_TOP - 6}>
        {interpolate(copy.max, { count: formatNumber(max, locale) })}
      </text>
    </svg>
  );
}

const CELL = 12;
const GAP = 2;
const HEAT_LEFT = 18;
const HEAT_TOP = 16;

/**
 * One column per week, Sunday at the top. Weeks outside the window fade; a click on a
 * column selects its week. The trend chart offers the same selection by keyboard.
 */
export function Heatmap({
  weeks,
  windowStart,
  selected,
  onSelect,
}: {
  readonly weeks: readonly ActivityWeek[];
  readonly windowStart: number;
  readonly selected: number;
  readonly onSelect: (index: number) => void;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.heatmap;
  const level = heatLevels(weeks);
  const step = CELL + GAP;
  const width = HEAT_LEFT + weeks.length * step;
  return (
    <div className="heatmap-scroll">
      <svg
        className="heatmap"
        viewBox={`0 0 ${String(width)} ${String(HEAT_TOP + 7 * step)}`}
        role="img"
        aria-label={copy.subtitle}
      >
        {[1, 3, 5].map((day) => (
          <text key={day} className="axis-label" x={0} y={HEAT_TOP + day * step + CELL - 2}>
            {t.activity.week.days[day]}
          </text>
        ))}
        {weeks.map((week, index) => {
          const previous = weeks[index - 1];
          const month = new Date(week.start).getUTCMonth();
          const newMonth =
            previous === undefined || new Date(previous.start).getUTCMonth() !== month;
          const x = HEAT_LEFT + index * step;
          return (
            <g
              key={week.start}
              className={`heat-week${index < windowStart ? ' heat-out' : ''}`}
              onClick={() => {
                onSelect(index);
              }}
            >
              {newMonth && index < weeks.length - 2 && (
                <text className="axis-label" x={x} y={10}>
                  {new Intl.DateTimeFormat(LOCALES[locale].tag, {
                    month: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(week.start))}
                </text>
              )}
              {week.days.map((count, day) => (
                <rect
                  key={day}
                  className={`heat heat-${String(level(count))}`}
                  x={x}
                  y={HEAT_TOP + day * step}
                  width={CELL}
                  height={CELL}
                  rx={2}
                >
                  <title>
                    {interpolate(copy.cell, {
                      date: dayMonth(
                        new Date(Date.parse(week.start) + day * 86_400_000).toISOString(),
                        locale,
                      ),
                      commits: formatNumber(count, locale),
                    })}
                  </title>
                </rect>
              ))}
            </g>
          );
        })}
        <rect
          className="heat-selected"
          x={HEAT_LEFT + selected * step - 2}
          y={HEAT_TOP - 2}
          width={CELL + 4}
          height={7 * step + 2}
          rx={4}
        />
      </svg>
      <p className="heat-legend" aria-hidden="true">
        {copy.less}
        {[0, 1, 2, 3, 4].map((value) => (
          <span key={value} className={`heat-swatch heat-${String(value)}`} />
        ))}
        {copy.more}
      </p>
    </div>
  );
}

const FLOW_WIDTH = 400;
const FLOW_HEIGHT = 150;

/** Who committed in each 13-week block above the line, who lapsed below it. */
export function FlowChart({
  flow,
  highlighted,
}: {
  readonly flow: ActivityReportResponse['flow'];
  /** Blocks covered by the window, counted from the most recent. */
  readonly highlighted: number;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.flow;
  const up = Math.max(1, ...flow.map((quarter) => quarter.active));
  const down = Math.max(1, ...flow.map((quarter) => quarter.lapsed));
  const scale = FLOW_HEIGHT / (up + down);
  const zero = 14 + up * scale;
  const slot = FLOW_WIDTH / Math.max(1, flow.length);
  return (
    <svg
      className="flow-chart"
      viewBox={`0 0 ${String(FLOW_WIDTH)} ${String(FLOW_HEIGHT + 50)}`}
      role="img"
      aria-label={flow
        .map((quarter) =>
          [
            interpolate(copy.from, { date: dayMonth(quarter.start, locale) }),
            `${copy.newcomers} ${String(quarter.newcomers)}`,
            `${copy.retained} ${String(quarter.retained)}`,
            `${copy.returning} ${String(quarter.returning)}`,
            `${copy.lapsed} ${String(quarter.lapsed)}`,
          ].join(', '),
        )
        .join('; ')}
    >
      {flow.map((quarter, index) => {
        const x = index * slot + slot * 0.22;
        const width = slot * 0.56;
        const stack = [
          ['flow-retained', quarter.retained],
          ['flow-returning', quarter.returning],
          ['flow-new', quarter.newcomers],
        ] as const;
        let top = zero;
        const dim = index < flow.length - highlighted;
        return (
          <g key={quarter.start} className={dim ? 'flow-out' : undefined}>
            {stack.map(([className, count]) => {
              top -= count * scale;
              return (
                <rect
                  key={className}
                  className={className}
                  x={x}
                  y={top}
                  width={width}
                  height={count * scale}
                />
              );
            })}
            <rect
              className="flow-lapsed"
              x={x}
              y={zero}
              width={width}
              height={quarter.lapsed * scale}
            />
            <text className="bar-value" x={x + width / 2} y={top - 4}>
              {formatNumber(quarter.active, locale)}
            </text>
            <text className="bar-value" x={x + width / 2} y={zero + quarter.lapsed * scale + 12}>
              {quarter.lapsed > 0 ? `−${formatNumber(quarter.lapsed, locale)}` : ''}
            </text>
            <text className="axis-label flow-axis" x={x + width / 2} y={FLOW_HEIGHT + 46}>
              {dayMonth(quarter.start, locale)}
            </text>
          </g>
        );
      })}
      <line className="trend-base" x1={0} x2={FLOW_WIDTH} y1={zero} y2={zero} />
    </svg>
  );
}

const PUNCH_LEFT = 34;
const PUNCH_STEP = 15;

/** Commits by day and hour as dots whose area follows the count. */
export function PunchCard({
  punchCard,
}: {
  readonly punchCard: ActivityReportResponse['rhythm']['punchCard'];
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.activity.rhythm;
  const max = Math.max(1, ...punchCard.flat());
  const radius = PUNCH_STEP / 2 - 1;
  return (
    <svg
      className="punch-card"
      viewBox={`0 0 ${String(PUNCH_LEFT + 24 * PUNCH_STEP)} ${String(7 * PUNCH_STEP + 18)}`}
      role="img"
      aria-label={copy.subtitle}
    >
      {punchCard.map((hours, day) => (
        <g key={day}>
          <text className="axis-label" x={0} y={day * PUNCH_STEP + PUNCH_STEP / 2 + 4}>
            {(copy.days[day] ?? '').slice(0, 3)}
          </text>
          {hours.map((count, hour) => (
            <circle
              key={hour}
              className={day === 0 || day === 6 ? 'punch punch-weekend' : 'punch'}
              cx={PUNCH_LEFT + hour * PUNCH_STEP + PUNCH_STEP / 2}
              cy={day * PUNCH_STEP + PUNCH_STEP / 2}
              r={count === 0 ? 0 : Math.max(1, Math.sqrt(count / max) * radius)}
            >
              <title>
                {interpolate(copy.cell, {
                  day: copy.days[day] ?? '',
                  hour: interpolate(copy.hour, { hour }),
                  commits: formatNumber(count, locale),
                })}
              </title>
            </circle>
          ))}
        </g>
      ))}
      {[0, 6, 12, 18].map((hour) => (
        <text
          key={hour}
          className="axis-label"
          x={PUNCH_LEFT + hour * PUNCH_STEP}
          y={7 * PUNCH_STEP + 14}
        >
          {interpolate(copy.hour, { hour })}
        </text>
      ))}
    </svg>
  );
}
