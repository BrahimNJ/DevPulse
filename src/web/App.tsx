import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';

import { ApiError, fetchBranchReport, type BranchReportResponse } from './api.ts';
import { BranchTable } from './BranchTable.tsx';
import { AlertIcon, ArrowIcon, ClockIcon, SearchIcon } from './icons.tsx';
import { Insights } from './Insights.tsx';
import { Layout } from './Layout.tsx';
import { timeUntil, useQuota } from './quota.ts';
import { Summary } from './Summary.tsx';

type LoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly repository: string }
  | { readonly kind: 'error'; readonly message: string; readonly quotaExceeded: boolean }
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

export function App(): JSX.Element {
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
        const quotaExceeded = error instanceof ApiError && error.status === 429;
        if (quotaExceeded) {
          refresh();
        }
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
          quotaExceeded,
        });
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
          <span className="kicker">Analyse</span>
          <h1>Branch health report</h1>
          <p className="lede">
            Every branch of a public repository: last activity, author, protection, and how far it
            drifted from the default branch.
          </p>

          <form className="analyse-form" onSubmit={onSubmit} role="search">
            <label className="input-with-icon">
              <SearchIcon />
              <span className="visually-hidden">Repository</span>
              <input
                value={repository}
                onChange={(event) => {
                  setRepository(event.target.value);
                }}
                placeholder="owner/repository"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <label className="select-field">
              <span>Stale after</span>
              <select
                value={staleDays}
                onChange={(event) => {
                  setStaleDays(Number(event.target.value));
                }}
              >
                {STALE_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="button button-primary"
              disabled={state.kind === 'loading'}
            >
              {state.kind === 'loading' ? 'Analysing…' : 'Analyse'}
              <ArrowIcon />
            </button>
          </form>

          <p className="hero-hint">
            Examples{' '}
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
              You have used today&apos;s three analyses. Repositories you already analysed still
              open; new ones are available again {timeUntil(quota.resetsAt)}.
            </p>
          )}
        </div>
      </section>

      <div className="container report">
        <Result state={state} />
      </div>
    </Layout>
  );
}

function Result({ state }: { readonly state: LoadState }): JSX.Element {
  switch (state.kind) {
    case 'idle':
      return <EmptyState />;
    case 'loading':
      return (
        <div className="loading" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          Reading the branches of <strong className="mono">{state.repository}</strong>…
        </div>
      );
    case 'error':
      return (
        <p
          className={`notice ${state.quotaExceeded ? 'notice-warn' : 'notice-error'}`}
          role="alert"
        >
          <AlertIcon />
          {state.message}
        </p>
      );
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
  return (
    <div className="empty-state">
      <h2>What the report shows</h2>
      <ul className="card-grid card-grid-3">
        <li className="card">
          <h3>Activity</h3>
          <p>When each branch last received a commit, and by whom.</p>
        </li>
        <li className="card">
          <h3>Abandoned work</h3>
          <p>Branches without a commit for longer than the threshold you choose.</p>
        </li>
        <li className="card">
          <h3>Divergence</h3>
          <p>Commits each branch has that main lacks, and the reverse.</p>
        </li>
      </ul>
    </div>
  );
}
