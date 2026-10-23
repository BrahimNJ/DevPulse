/**
 * Usage statistics for the maintainer (ADR 0011). Each analysis is recorded as an
 * anonymous event: the salted visitor hash of ADR 0008, never the address, kept 30 days.
 */

export type ReportKind = 'branches' | 'delivery';

/** Why an analysis ended as it did, from the answer the visitor received. */
export type Outcome =
  | 'ok'
  | 'invalid'
  | 'not-found'
  | 'allowance'
  | 'rate-limited'
  | 'github'
  | 'unavailable'
  | 'timeout'
  | 'error';

export type Device = 'mobile' | 'desktop' | 'bot';
export type Language = 'fr' | 'en' | 'other';

export interface AnalysisEvent {
  readonly at: Date;
  readonly report: ReportKind;
  /** Lower-case `owner/name`, or null when the request named none that is valid. */
  readonly repository: string | null;
  readonly visitor: string;
  readonly owner: boolean;
  readonly status: number;
  readonly outcome: Outcome;
  readonly durationMs: number;
  /** Null when no repository data was loaded. */
  readonly cacheHit: boolean | null;
  readonly device: Device;
  readonly language: Language;
}

/** Persistence of the events; `recent` returns the newest first. */
export interface EventStore {
  add(event: AnalysisEvent): Promise<void>;
  recent(since: Date, limit: number): Promise<AnalysisEvent[]>;
}

export class MemoryEventStore implements EventStore {
  readonly #events: AnalysisEvent[] = [];

  add(event: AnalysisEvent): Promise<void> {
    this.#events.push(event);
    return Promise.resolve();
  }

  recent(since: Date, limit: number): Promise<AnalysisEvent[]> {
    return Promise.resolve(
      this.#events
        .filter((event) => event.at >= since)
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, limit),
    );
  }
}

/**
 * The outcome behind a status. A 429 carrying the allowance headers is the daily
 * allowance; without them it is the per-minute rate limit.
 */
export function outcomeOf(status: number, allowanceHeaders: boolean): Outcome {
  if (status === 429) {
    return allowanceHeaders ? 'allowance' : 'rate-limited';
  }
  const outcomes: Readonly<Record<number, Outcome>> = {
    200: 'ok',
    400: 'invalid',
    404: 'not-found',
    502: 'github',
    503: 'unavailable',
    504: 'timeout',
  };
  return outcomes[status] ?? 'error';
}

const BOT = /bot|crawl|spider|slurp|curl|wget|python|headless|monitor/iu;
const MOBILE = /mobile|android|iphone|ipad|ipod/iu;

/** A coarse device class: the user agent itself is not kept. */
export function deviceOf(userAgent: string | undefined): Device {
  if (userAgent === undefined || BOT.test(userAgent)) {
    return 'bot';
  }
  return MOBILE.test(userAgent) ? 'mobile' : 'desktop';
}

/** The visitor's first preferred language, as French, English or other. */
export function languageOf(acceptLanguage: string | undefined): Language {
  const first = acceptLanguage?.split(',')[0]?.trim().toLowerCase().slice(0, 2);
  return first === 'fr' || first === 'en' ? first : 'other';
}

export interface AdminStats {
  readonly generatedAt: string;
  readonly days: number;
  /** True when more events exist than were read; the figures then cover the newest. */
  readonly truncated: boolean;
  readonly totals: {
    readonly visitors: number;
    readonly analyses: number;
    readonly succeeded: number;
    readonly failed: number;
    readonly deliveryOpened: number;
    readonly repositories: number;
    readonly cacheHitRate: number | null;
    readonly medianMs: number | null;
    readonly p90Ms: number | null;
    /** Visitors who reached their daily allowance at least once. */
    readonly allowanceReached: number;
  };
  readonly perDay: readonly {
    readonly date: string;
    readonly succeeded: number;
    readonly failed: number;
    readonly visitors: number;
  }[];
  readonly outcomes: readonly { readonly outcome: Outcome; readonly count: number }[];
  readonly repositories: readonly {
    readonly name: string;
    readonly analyses: number;
    readonly failed: number;
  }[];
  readonly failures: readonly {
    readonly at: string;
    readonly report: ReportKind;
    readonly repository: string | null;
    readonly outcome: Outcome;
    readonly status: number;
  }[];
  readonly devices: Readonly<Record<Device, number>>;
  readonly languages: Readonly<Record<Language, number>>;
  readonly github: { readonly remaining: number; readonly resetsAt: string } | null;
}

const DAY_MS = 86_400_000;
const TOP_REPOSITORIES = 10;
const LATEST_FAILURES = 15;

/**
 * Figures over the last `days` days, the maintainer's own analyses left out. An
 * analysis is a branch report, which the interface always requests first; delivery
 * reports are counted apart.
 */
export function summarise(
  events: readonly AnalysisEvent[],
  options: {
    readonly now: Date;
    readonly days: number;
    readonly truncated: boolean;
    readonly github: AdminStats['github'];
  },
): AdminStats {
  const visitorEvents = events.filter((event) => !event.owner);
  const analyses = visitorEvents.filter((event) => event.report === 'branches');
  const failed = analyses.filter((event) => event.outcome !== 'ok');
  const loaded = visitorEvents.filter((event) => event.cacheHit !== null);
  const durations = analyses
    .filter((event) => event.outcome === 'ok')
    .map((event) => event.durationMs)
    .sort((a, b) => a - b);
  return {
    generatedAt: options.now.toISOString(),
    days: options.days,
    truncated: options.truncated,
    totals: {
      visitors: distinct(visitorEvents.map((event) => event.visitor)),
      analyses: analyses.length,
      succeeded: analyses.length - failed.length,
      failed: failed.length,
      deliveryOpened: visitorEvents.filter(
        (event) => event.report === 'delivery' && event.outcome === 'ok',
      ).length,
      repositories: distinct(
        analyses.flatMap((event) => (event.repository === null ? [] : [event.repository])),
      ),
      cacheHitRate:
        loaded.length === 0
          ? null
          : loaded.filter((event) => event.cacheHit === true).length / loaded.length,
      medianMs: nearestRank(durations, 0.5),
      p90Ms: nearestRank(durations, 0.9),
      allowanceReached: distinct(
        visitorEvents.filter((event) => event.outcome === 'allowance').map((e) => e.visitor),
      ),
    },
    perDay: perDay(analyses, options.now, options.days),
    outcomes: countBy(failed, (event) => event.outcome).map(([outcome, count]) => ({
      outcome,
      count,
    })),
    repositories: repositories(analyses),
    failures: visitorEvents
      .filter((event) => event.outcome !== 'ok')
      .slice(0, LATEST_FAILURES)
      .map((event) => ({
        at: event.at.toISOString(),
        report: event.report,
        repository: event.repository,
        outcome: event.outcome,
        status: event.status,
      })),
    devices: tally(analyses, (event) => event.device, { mobile: 0, desktop: 0, bot: 0 }),
    languages: tally(analyses, (event) => event.language, { fr: 0, en: 0, other: 0 }),
    github: options.github,
  };
}

function distinct(values: readonly string[]): number {
  return new Set(values).size;
}

function nearestRank(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? null;
}

/** Every day of the period, oldest first, including days without any analysis. */
function perDay(analyses: readonly AnalysisEvent[], now: Date, days: number): AdminStats['perDay'] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    const onDay = analyses.filter((event) => event.at.toISOString().startsWith(date));
    const failedOnDay = onDay.filter((event) => event.outcome !== 'ok').length;
    return {
      date,
      succeeded: onDay.length - failedOnDay,
      failed: failedOnDay,
      visitors: distinct(onDay.map((event) => event.visitor)),
    };
  });
}

function repositories(analyses: readonly AnalysisEvent[]): AdminStats['repositories'] {
  const named = analyses.filter(
    (event): event is AnalysisEvent & { repository: string } => event.repository !== null,
  );
  return countBy(named, (event) => event.repository)
    .slice(0, TOP_REPOSITORIES)
    .map(([name, count]) => ({
      name,
      analyses: count,
      failed: named.filter((event) => event.repository === name && event.outcome !== 'ok').length,
    }));
}

/** Keys by descending count, then alphabetically, so the order is stable. */
function countBy<T, K extends string>(items: readonly T[], key: (item: T) => K): [K, number][] {
  const counts = new Map<K, number>();
  for (const item of items) {
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function tally<T, K extends string>(
  items: readonly T[],
  key: (item: T) => K,
  initial: Record<K, number>,
): Record<K, number> {
  const result = { ...initial };
  for (const item of items) {
    result[key(item)] += 1;
  }
  return result;
}
