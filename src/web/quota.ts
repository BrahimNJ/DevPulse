import { useCallback, useEffect, useState } from 'react';

import { fetchQuota, type QuotaResponse, type ReportResult } from './api.ts';
import { formatNumber, interpolate, type Locale, type Messages } from './i18n.ts';

export interface QuotaState {
  /** Null until the server has answered. */
  readonly quota: QuotaResponse | null;
  /** Applies the allowance returned with a report. */
  readonly update: (quota: ReportResult['quota']) => void;
  readonly refresh: () => void;
}

/** The visitor's daily allowance, loaded once and kept current by each report. */
export function useQuota(): QuotaState {
  const [quota, setQuota] = useState<QuotaResponse | null>(null);

  const refresh = useCallback((): void => {
    fetchQuota().then(setQuota, () => {
      // Without an answer the interface simply shows no allowance.
    });
  }, []);

  useEffect(refresh, [refresh]);

  const update = useCallback((next: ReportResult['quota']): void => {
    if (next !== null) {
      setQuota((current) => ({ owner: current?.owner ?? false, ...next }));
    }
  }, []);

  return { quota, update, refresh };
}

/** "2 of 3 analyses left today", the owner's label, or null when there is no allowance. */
export function describeQuota(
  quota: QuotaResponse | null,
  t: Messages,
  locale: Locale,
): string | null {
  if (quota === null) {
    return null;
  }
  if (quota.owner) {
    return t.quota.owner;
  }
  if (quota.limit === null || quota.remaining === null) {
    return null;
  }
  return interpolate(t.quota.left, {
    remaining: formatNumber(quota.remaining, locale),
    limit: formatNumber(quota.limit, locale),
  });
}

/** "in 14 h 12 min" until `iso`, for the reset of the allowance. */
export function timeUntil(iso: string | null, t: Messages, now: Date = new Date()): string {
  if (iso === null) {
    return t.quota.within;
  }
  const minutes = Math.max(1, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0
    ? interpolate(t.quota.inMinutes, { minutes })
    : interpolate(t.quota.inHours, {
        hours,
        minutes: String(minutes % 60).padStart(2, '0'),
      });
}
