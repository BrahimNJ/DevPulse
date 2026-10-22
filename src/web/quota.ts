import { useCallback, useEffect, useState } from 'react';

import { fetchQuota, type QuotaResponse, type ReportResult } from './api.ts';

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

/** "3 of 3 analyses left today", "Unlimited (owner)", or null when there is no allowance. */
export function describeQuota(quota: QuotaResponse | null): string | null {
  if (quota === null) {
    return null;
  }
  if (quota.owner) {
    return 'Unlimited · owner';
  }
  if (quota.limit === null || quota.remaining === null) {
    return null;
  }
  return `${String(quota.remaining)} of ${String(quota.limit)} analyses left today`;
}

/** "in 14 h 12 min" until `iso`, for the reset of the allowance. */
export function timeUntil(iso: string | null, now: Date = new Date()): string {
  if (iso === null) {
    return 'within 24 hours';
  }
  const minutes = Math.max(1, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0
    ? `in ${String(minutes)} min`
    : `in ${String(hours)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
