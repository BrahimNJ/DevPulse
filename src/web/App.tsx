import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';

import { ApiError, fetchBranchReport, type BranchReportResponse } from './api.ts';
import { BranchTable } from './BranchTable.tsx';
import { formatNumber, interpolate, type Messages } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { AlertIcon, ArrowIcon, ClockIcon, SearchIcon } from './icons.tsx';
import { Insights } from './Insights.tsx';
import { Layout } from './Layout.tsx';
import { timeUntil, useQuota } from './quota.ts';
import { Summary } from './Summary.tsx';

type LoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly repository: string }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly report: BranchReportResponse };

const STALE_OPTIONS = [30, 90, 180, 365] as const;
const EXAMPLES = ['nodejs/node', 'facebook/react', 'vitejs/vite'] as const;

function initialQuery(): { repository: string; staleDays: number } {
  const params = new URLSearchParams(window.location.search);
  const staleDays = Number(params.get('staleDays'));
  return {
    repository: params.get('repo') ?? '',
    staleDays: STALE_OPTIONS.some((option) => option === staleDays) ? staleDays : 90,
  };
}

/** The failure in the visitor's language; the server's own text is the last resort. */
function describeError(error: unknown, t: Messages, limit: number | null): string {
  if (!(error instanceof ApiError)) {
    return t.app.errors.generic;
  }
  if (error.status === 429) {
    return error.quotaExceeded
      ? interpolate(t.app.errors['429'], {
          limit: limit ?? 3,
          when: timeUntil(error.resetsAt, t),
        })
      : t.app.errors.tooManyRequests;
  }
  const known: Readonly<Record<number, string>> = {
    400: t.app.errors['400'],
    404: t.app.errors['404'],
    502: t.app.errors['502'],
    503: t.app.errors['503'],
    504: t.app.errors['504'],
  };
  return known[error.status] ?? t.app.errors.generic;
}

export function App(): JSX.Element {
  const { t, locale } = useI18n();
  const [initial] = useState(initialQuery);
  const [repository, setRepository] = useState(initial.repository);
  const [staleDays, setStaleDays] = useState(initial.staleDays);
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const inFlight = useRef<AbortController | null>(null);
  const { quota, update, refresh } = useQuota();

  function analyse(target: string, days: number): void {
    const trimmed = target.trim();
    if (trimmed === '') {
      return;
    }
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    // Keep the URL shareable: reloading it shows the same report.
    const query = new URLSearchParams({ repo: trimmed, staleDays: String(days) });
    window.history.replaceState(null, '', `?${query.toString()}`);
    setState({ kind: 'loading', repository: trimmed });

    fetchBranchReport(trimmed, days, controller.signal).then(
      (result) => {
        update(result.quota);
        // A newer request may have started while this one was resolving.
        if (!controller.signal.aborted) {
          setState({ kind: 'ready', report: result.report });
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.quotaExceeded) {
          refresh();
        }
        setState({ kind: 'error', error });
      },
    );
  }

  useEffect(() => {
    if (initial.repository !== '') {
      analyse(initial.repository, initial.staleDays);
    }
    return (): void => {
      inFlight.current?.abort();
    };
    // Runs once, for a report requested through the URL.
  }, []);

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    analyse(repository, staleDays);
  }

  const exhausted = quota?.remaining === 0;

  return (
    <Layout page="app" quota={quota}>
      <section className="app-hero">
        <div className="container">
          <span className="kicker">{t.app.kicker}</span>
          <h1>{t.app.title}</h1>
          <p className="lede">{t.app.lede}</p>

          <form className="analyse-form" onSubmit={onSubmit} role="search">
            <label className="input-with-icon">
              <SearchIcon />
              <span className="visually-hidden">{t.home.repositoryLabel}</span>
              <input
                value={repository}
                onChange={(event) => {
                  setRepository(event.target.value);
                }}
                placeholder={t.home.placeholder}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="select-field">
              <span>{t.app.staleAfter}</span>
              <select
                value={staleDays}
                onChange={(event) => {
                  setStaleDays(Number(event.target.value));
                }}
              >
                {STALE_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {interpolate(t.app.days, { days: formatNumber(days, locale) })}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="button button-primary"
              disabled={state.kind === 'loading'}
            >
              {state.kind === 'loading' ? t.app.analysing : t.home.analyse}
              <ArrowIcon />
            </button>
          </form>

          <p className="hero-hint">
            {t.app.examples}{' '}
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="chip"
                onClick={() => {
                  setRepository(example);
                  analyse(example, staleDays);
                }}
              >
                {example}
              </button>
            ))}
          </p>

          {exhausted && (
            <p className="notice notice-warn" role="status">
              <ClockIcon />
              {interpolate(t.quota.exhausted, {
                limit: quota.limit ?? 3,
                when: timeUntil(quota.resetsAt, t),
              })}
            </p>
          )}
        </div>
      </section>

      <div className="container report">
        <Result state={state} limit={quota?.limit ?? null} />
      </div>
    </Layout>
  );
}

function Result({
  state,
  limit,
}: {
  readonly state: LoadState;
  readonly limit: number | null;
}): JSX.Element {
  const { t } = useI18n();
  switch (state.kind) {
    case 'idle':
      return <EmptyState />;
    case 'loading': {
      const [before, after] = t.app.loading.split('{repository}');
      return (
        <div className="loading" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>
            {before}
            <strong className="mono">{state.repository}</strong>
            {after}
          </span>
        </div>
      );
    }
    case 'error': {
      const quotaExceeded = state.error instanceof ApiError && state.error.status === 429;
      return (
        <p className={`notice ${quotaExceeded ? 'notice-warn' : 'notice-error'}`} role="alert">
          <AlertIcon />
          {describeError(state.error, t, limit)}
        </p>
      );
    }
    case 'ready':
      return (
        <>
          <Summary report={state.report} />
          <Insights report={state.report} />
          <BranchTable report={state.report} />
        </>
      );
  }
}

function EmptyState(): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <h2>{t.app.empty.title}</h2>
      <ul className="card-grid card-grid-3">
        {t.app.empty.cards.map((card) => (
          <li key={card.title} className="card">
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
