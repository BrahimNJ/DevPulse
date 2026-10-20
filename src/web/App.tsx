import { useEffect, useRef, useState, type JSX, type SyntheticEvent } from 'react';

import { fetchBranchReport, type BranchReportResponse } from './api.ts';
import { BranchTable } from './BranchTable.tsx';
import { AlertIcon, PulseIcon, SearchIcon } from './icons.tsx';
import { Summary } from './Summary.tsx';

type LoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading'; readonly repository: string }
  | { readonly kind: 'error'; readonly message: string }
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
      (report) => {
        setState({ kind: 'ready', report });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
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

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">
            <PulseIcon />
          </span>
          <span className="brand-name">DevPulse</span>
        </div>
        <a className="masthead-link" href="https://github.com/BrahimNJ/DevPulse">
          Source code
        </a>
      </header>

      <main>
        <section className="hero">
          <h1>Branch health for any public GitHub repository</h1>
          <p className="lede">
            See every branch at a glance: last activity, authors, protection and abandoned work.
          </p>

          <form className="search" onSubmit={onSubmit} role="search">
            <label className="search-field">
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
            <label className="stale-field">
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
            <button type="submit" disabled={state.kind === 'loading'}>
              {state.kind === 'loading' ? 'Analysing…' : 'Analyse'}
            </button>
          </form>

          <p className="examples">
            Try{' '}
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
        </section>

        <Result state={state} />
      </main>

      <footer className="footer">
        Data from the GitHub GraphQL and REST APIs. Built with TypeScript, React and Vite.
      </footer>
    </div>
  );
}

function Result({ state }: { readonly state: LoadState }): JSX.Element | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'loading':
      return (
        <p className="status" aria-live="polite">
          Reading branches of <strong>{state.repository}</strong>…
        </p>
      );
    case 'error':
      return (
        <p className="status status-error" role="alert">
          <AlertIcon />
          {state.message}
        </p>
      );
    case 'ready':
      return (
        <>
          <Summary report={state.report} />
          <BranchTable report={state.report} />
        </>
      );
  }
}
