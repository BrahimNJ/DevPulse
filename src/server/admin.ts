import { parseRepository } from '../branches/input.ts';
import type { Quota } from '../github/client.ts';
import {
  deviceOf,
  languageOf,
  outcomeOf,
  summarise,
  type AdminStats,
  type EventStore,
  type ReportKind,
} from './analytics.ts';
import type { Visitor } from './api.ts';

/** What the server needs to record analyses and show statistics (ADR 0011). */
export interface Analytics {
  readonly events: EventStore;
  /** The scarcest GitHub quota the server has seen, if any. */
  readonly githubQuota: (now: Date) => Quota | null;
  /** Reports a failure to record, which must never fail the visitor's request. */
  readonly warn: (message: string) => void;
}

/** Statistics read at most this many events: about a month at a few hundred a day. */
export const MAX_EVENTS = 5000;

const DAY_MS = 86_400_000;

export interface AnalysisRecord {
  readonly report: ReportKind;
  readonly query: URLSearchParams;
  readonly visitor: Visitor;
  readonly headers: { readonly userAgent?: string; readonly acceptLanguage?: string };
  readonly at: Date;
  readonly status: number;
  /** Whether the answer carried the daily allowance headers. */
  readonly allowanceHeaders: boolean;
  readonly durationMs: number;
  readonly cacheHit: boolean | null;
}

/** Longest repository name kept: GitHub owners and names are shorter than this. */
const MAX_NAME_LENGTH = 140;
/** Recording waits at most this long, whatever hangs: the token or Firestore. */
const RECORD_TIMEOUT_MS = 1000;
/** A statistics view is reused this long, so refreshing does not reread every event. */
const STATS_TTL_MS = 60_000;

/** Stores one analysis; a failure or a slow store is reported, never thrown. */
export async function recordAnalysis(
  analytics: Analytics | undefined,
  record: AnalysisRecord,
): Promise<void> {
  if (analytics === undefined) {
    return;
  }
  const repository = parseRepository(record.query.get('repo') ?? '');
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${String(RECORD_TIMEOUT_MS)} ms`));
    }, RECORD_TIMEOUT_MS);
  });
  try {
    await Promise.race([
      analytics.events.add({
        at: record.at,
        report: record.report,
        repository:
          repository === null
            ? null
            : `${repository.owner}/${repository.name}`.toLowerCase().slice(0, MAX_NAME_LENGTH),
        visitor: record.visitor.id,
        owner: record.visitor.owner,
        status: record.status,
        outcome: outcomeOf(record.status, record.allowanceHeaders),
        durationMs: record.durationMs,
        cacheHit: record.cacheHit,
        device: deviceOf(record.headers.userAgent),
        language: languageOf(record.headers.acceptLanguage),
      }),
      timeout,
    ]);
  } catch (error) {
    analytics.warn(
      `Could not record an analysis: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

const viewCache = new WeakMap<Analytics, Map<number, { expires: number; stats: AdminStats }>>();

/**
 * `GET /api/admin/stats?days=7|30`, for the owner only; the caller checks access. The
 * period starts at UTC midnight of its first day, as the per-day figures do, and each
 * view is reused for a minute: a view reads up to 5,000 documents.
 */
export async function handleStatsRequest(
  analytics: Analytics,
  query: URLSearchParams,
  now: Date,
): Promise<AdminStats> {
  const days = query.get('days') === '30' ? 30 : 7;
  const views =
    viewCache.get(analytics) ?? new Map<number, { expires: number; stats: AdminStats }>();
  viewCache.set(analytics, views);
  const cached = views.get(days);
  if (cached !== undefined && cached.expires > now.getTime()) {
    return cached.stats;
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const events = await analytics.events.recent(
    new Date(today - (days - 1) * DAY_MS),
    MAX_EVENTS + 1,
  );
  const quota = analytics.githubQuota(now);
  const stats = summarise(events.slice(0, MAX_EVENTS), {
    now,
    days,
    truncated: events.length > MAX_EVENTS,
    github:
      quota === null
        ? null
        : { remaining: quota.remaining, resetsAt: quota.resetsAt.toISOString() },
  });
  views.set(days, { expires: now.getTime() + STATS_TTL_MS, stats });
  return stats;
}
