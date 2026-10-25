import { AnimatePresence, m } from 'motion/react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';

import {
  ApiError,
  fetchBranchReport,
  fetchDeliveryReport,
  type BranchReportResponse,
  type DeliveryReportResponse,
  type QuotaResponse,
} from './api.ts';
import { BranchTable } from './BranchTable.tsx';
import { DeliveryView } from './Delivery.tsx';
import { DEMO_BRANCH_REPORT, DEMO_DELIVERY_REPORT, DEMO_REPOSITORY } from './demo.ts';
import { formatDate } from './format.ts';
import { formatNumber, interpolate, type Messages } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { AlertIcon, ArrowIcon, ClockIcon, GitHubIcon, SearchIcon } from './icons.tsx';
import { Insights } from './Insights.tsx';
import { Layout } from './Layout.tsx';
import { Loading } from './Loading.tsx';
import { EASE_OUT } from './motion.tsx';
import { describeQuota, timeUntil, useQuota } from './quota.ts';
import { readRecent, rememberRecent } from './recent.ts';
import { Summary } from './Summary.tsx';

type Load<T> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'ready'; readonly report: T };

type Tab = 'branches' | 'delivery';

const STALE_OPTIONS = [30, 90, 180, 365] as const;
const EXAMPLES = ['nodejs/node', 'facebook/react', 'kubernetes/kubernetes'] as const;
const TABS: readonly Tab[] = ['branches', 'delivery'];

function initialQuery(): { repository: string; staleDays: number; tab: Tab } {
  const params = new URLSearchParams(window.location.search);
  const staleDays = Number(params.get('staleDays'));
  return {
    repository: params.get('repo') ?? '',
    staleDays: STALE_OPTIONS.some((option) => option === staleDays) ? staleDays : 90,
    tab: params.get('tab') === 'delivery' ? 'delivery' : 'branches',
  };
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The failure in the visitor's language, from its status: the server's messages are in
 * English, so an unknown status gets a generic message rather than the server's text.
 */
function describeError(error: unknown, t: Messages, limit: number | null): string {
  if (!(error instanceof ApiError)) {
    return t.app.errors.generic;
  }
  if (error.status === 429) {
    return error.quotaExceeded
      ? interpolate(t.app.errors['429'], { limit: limit ?? 3, when: timeUntil(error.resetsAt, t) })
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
  const [initial] = useState(initialQuery);
  const [repository, setRepository] = useState(initial.repository);
  const [staleDays, setStaleDays] = useState(initial.staleDays);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [branches, setBranches] = useState<Load<BranchReportResponse>>({ kind: 'idle' });
  const [delivery, setDelivery] = useState<Load<DeliveryReportResponse>>({ kind: 'idle' });
  const [recent, setRecent] = useState(() => readRecent(storage()));
  const inFlight = useRef<AbortController | null>(null);
  const { quota, update, refresh } = useQuota();

  function analyse(target: string, days: number, nextTab: Tab = tab): void {
    const trimmed = target.trim();
    if (trimmed === '') {
      return;
    }
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    // Keep the URL shareable: reloading it shows the same report and tab.
    writeUrl(trimmed, days, nextTab);
    setBranches({ kind: 'loading' });
    setDelivery({ kind: 'loading' });

    const settle =
      <T,>(set: (load: Load<T>) => void) =>
      (result: { report: T; quota: Parameters<typeof update>[0] }): void => {
        update(result.quota);
        if (!controller.signal.aborted) {
          set({ kind: 'ready', report: result.report });
        }
      };
    const fail =
      <T,>(set: (load: Load<T>) => void) =>
      (error: unknown): void => {
        if (controller.signal.aborted) {
          return;
        }
        if (error instanceof ApiError && error.quotaExceeded) {
          refresh();
        }
        set({ kind: 'error', error });
      };

    // The branch report reserves the repository in the allowance; delivery then reuses it.
    fetchBranchReport(trimmed, days, controller.signal).then(
      (result) => {
        settle(setBranches)(result);
        if (controller.signal.aborted) {
          return;
        }
        setRecent(rememberRecent(storage(), result.report.repository));
        fetchDeliveryReport(trimmed, controller.signal).then(
          settle(setDelivery),
          fail(setDelivery),
        );
      },
      (error: unknown) => {
        fail(setBranches)(error);
        fail(setDelivery)(error);
      },
    );
  }

  function writeUrl(target: string, days: number, nextTab: Tab): void {
    const query = new URLSearchParams({ repo: target, staleDays: String(days), tab: nextTab });
    window.history.replaceState(null, '', `?${query.toString()}`);
  }

  function selectTab(next: Tab): void {
    setTab(next);
    if (branches.kind !== 'idle') {
      writeUrl(repository, staleDays, next);
    }
  }

  useEffect(() => {
    if (initial.repository !== '') {
      analyse(initial.repository, initial.staleDays, initial.tab);
    }
    return (): void => {
      inFlight.current?.abort();
    };
    // Runs once, for a report requested through the URL.
  }, []);

  const isDemo = branches.kind === 'idle';
  return (
    <Layout page="app" quota={quota}>
      <div className="container workspace">
        <Sidebar
          repository={repository}
          staleDays={staleDays}
          busy={branches.kind === 'loading'}
          quota={quota}
          recent={recent}
          onRepository={setRepository}
          onStaleDays={setStaleDays}
          onAnalyse={(target) => {
            setRepository(target);
            analyse(target, staleDays);
          }}
        />
        <section className="workspace-main">
          <WorkspaceHeader
            repository={isDemo ? DEMO_REPOSITORY : headingOf(branches, repository)}
            generatedAt={branches.kind === 'ready' ? branches.report.generatedAt : null}
            demo={isDemo}
          />
          <Tabs tab={tab} onSelect={selectTab} />
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={tab}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              className="tab-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              {tab === 'branches' ? (
                <BranchesPanel
                  load={isDemo ? demo(DEMO_BRANCH_REPORT) : branches}
                  repository={repository.trim()}
                  limit={quota?.limit ?? null}
                />
              ) : (
                <DeliveryPanel
                  load={isDemo ? demo(DEMO_DELIVERY_REPORT) : delivery}
                  limit={quota?.limit ?? null}
                />
              )}
            </m.div>
          </AnimatePresence>
        </section>
      </div>
    </Layout>
  );
}

/** The name GitHub returned once a report is ready, the typed one until then. */
function headingOf(load: Load<BranchReportResponse>, typed: string): string {
  return load.kind === 'ready' ? load.report.repository : typed.trim();
}

function demo<T>(report: T): Load<T> {
  return { kind: 'ready', report };
}

function Sidebar({
  repository,
  staleDays,
  busy,
  quota,
  recent,
  onRepository,
  onStaleDays,
  onAnalyse,
}: {
  readonly repository: string;
  readonly staleDays: number;
  readonly busy: boolean;
  readonly quota: QuotaResponse | null;
  readonly recent: readonly string[];
  readonly onRepository: (value: string) => void;
  readonly onStaleDays: (value: number) => void;
  readonly onAnalyse: (repository: string) => void;
}): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.workspace;

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    onAnalyse(repository);
  }

  return (
    <aside className="sidebar">
      <section className="side-card">
        <h2>{copy.searchTitle}</h2>
        <form className="side-form" onSubmit={onSubmit} role="search">
          <label className="input-with-icon">
            <SearchIcon />
            <span className="visually-hidden">{t.home.repositoryLabel}</span>
            <input
              value={repository}
              onChange={(event) => {
                onRepository(event.target.value);
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
                onStaleDays(Number(event.target.value));
              }}
            >
              {STALE_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {interpolate(t.app.days, { days: formatNumber(days, locale) })}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? t.app.analysing : t.home.analyse}
            <ArrowIcon />
          </button>
        </form>
        <p className="side-examples">
          {t.app.examples}{' '}
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              onClick={() => {
                onAnalyse(example);
              }}
            >
              {example}
            </button>
          ))}
        </p>
      </section>

      <AllowanceCard quota={quota} />

      <section className="side-card">
        <h2>{copy.recentTitle}</h2>
        {recent.length === 0 ? (
          <p className="muted small">{copy.recentEmpty}</p>
        ) : (
          <ul className="recent-list">
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="link-button mono"
                  onClick={() => {
                    onAnalyse(item);
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="side-card">
        <h2>{copy.glossaryTitle}</h2>
        <dl className="glossary">
          {copy.glossary.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.definition}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}

function AllowanceCard({ quota }: { readonly quota: QuotaResponse | null }): JSX.Element {
  const { t } = useI18n();
  const limited =
    quota !== null && !quota.owner && quota.limit !== null && quota.remaining !== null;
  return (
    <section className="side-card">
      <h2>{t.workspace.allowanceTitle}</h2>
      {limited ? (
        <Allowance quota={quota} limit={quota.limit} remaining={quota.remaining} />
      ) : (
        <p className="muted small">
          {quota?.owner === true ? t.quota.owner : t.workspace.allowanceUnlimited}
        </p>
      )}
    </section>
  );
}

function Allowance({
  quota,
  limit,
  remaining,
}: {
  readonly quota: QuotaResponse;
  readonly limit: number;
  readonly remaining: number;
}): JSX.Element {
  const { t, locale } = useI18n();
  return (
    <>
      <p className="allowance">
        <strong>{formatNumber(remaining, locale)}</strong>
        <span>/ {formatNumber(limit, locale)}</span>
      </p>
      <p className="muted small">{describeQuota(quota, t, locale)}</p>
      {remaining === 0 && (
        <p className="notice notice-warn small" role="status">
          <ClockIcon />
          {interpolate(t.quota.exhausted, { limit, when: timeUntil(quota.resetsAt, t) })}
        </p>
      )}
      <p className="muted small">{t.workspace.allowanceHint}</p>
    </>
  );
}

function WorkspaceHeader({
  repository,
  generatedAt,
  demo: isDemo,
}: {
  readonly repository: string;
  readonly generatedAt: string | null;
  readonly demo: boolean;
}): JSX.Element {
  const { t, locale } = useI18n();
  return (
    <header className="workspace-header">
      <div>
        <h1 className="repository-heading mono">
          {repository}
          {isDemo && <span className="badge badge-muted">{t.workspace.example}</span>}
        </h1>
        <p className="muted small">
          {isDemo
            ? t.workspace.exampleNote
            : generatedAt === null
              ? ' '
              : formatDate(generatedAt, locale)}
        </p>
      </div>
      {/* Only for a report: then the name is the one the server read on GitHub. */}
      {!isDemo && generatedAt !== null && (
        <a className="button button-ghost button-small" href={`https://github.com/${repository}`}>
          <GitHubIcon /> {t.workspace.openOnGitHub}
        </a>
      )}
    </header>
  );
}

/** The tab a key leads to from `index`, wrapping around, or null for other keys. */
function tabForKey(key: string, index: number): Tab | null {
  const targets: Readonly<Record<string, number>> = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1 + TABS.length,
    Home: 0,
    End: TABS.length - 1,
  };
  const target = targets[key];
  return target === undefined ? null : (TABS[target % TABS.length] ?? null);
}

/**
 * WAI-ARIA tabs: arrow keys, Home and End move between them, as in any desktop tool. An
 * indicator glides under the selected tab, measured from it, so it follows the text in
 * either language.
 */
function Tabs({
  tab,
  onSelect,
}: {
  readonly tab: Tab;
  readonly onSelect: (tab: Tab) => void;
}): JSX.Element {
  const { t } = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);

  useLayoutEffect(() => {
    function measure(): void {
      const selected = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (selected !== null && selected !== undefined) {
        setIndicator({ x: selected.offsetLeft, width: selected.offsetWidth });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return (): void => {
      window.removeEventListener('resize', measure);
    };
  }, [tab, t]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const next = tabForKey(event.key, TABS.indexOf(tab));
    if (next === null) {
      return;
    }
    event.preventDefault();
    onSelect(next);
    document.getElementById(`tab-${next}`)?.focus();
  }
  return (
    <div
      ref={list}
      className="tabs"
      role="tablist"
      aria-label={t.workspace.tabsLabel}
      onKeyDown={onKeyDown}
    >
      {indicator !== null && (
        <m.span
          className="tab-indicator"
          aria-hidden="true"
          initial={false}
          animate={{ x: indicator.x, width: indicator.width }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      {TABS.map((item) => (
        <button
          key={item}
          id={`tab-${item}`}
          type="button"
          role="tab"
          aria-selected={tab === item}
          // Only the selected tab's panel is rendered.
          aria-controls={tab === item ? `panel-${item}` : undefined}
          tabIndex={tab === item ? 0 : -1}
          onClick={() => {
            onSelect(item);
          }}
        >
          {t.workspace.tabs[item]}
          {item === 'delivery' && <span className="tab-new">{t.workspace.tabs.new}</span>}
        </button>
      ))}
    </div>
  );
}

function BranchesPanel({
  load,
  repository,
  limit,
}: {
  readonly load: Load<BranchReportResponse>;
  readonly repository: string;
  readonly limit: number | null;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <LoadView load={load} limit={limit} loading={interpolate(t.app.loading, { repository })}>
      {(report) => (
        <>
          <Summary report={report} />
          <Insights report={report} />
          <BranchTable report={report} />
        </>
      )}
    </LoadView>
  );
}

function DeliveryPanel({
  load,
  limit,
}: {
  readonly load: Load<DeliveryReportResponse>;
  readonly limit: number | null;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <LoadView load={load} limit={limit} loading={t.delivery.loading}>
      {(report) => <DeliveryView report={report} />}
    </LoadView>
  );
}

function LoadView<T>({
  load,
  limit,
  loading,
  children,
}: {
  readonly load: Load<T>;
  readonly limit: number | null;
  readonly loading: string;
  readonly children: (report: T) => ReactNode;
}): JSX.Element {
  const { t } = useI18n();
  switch (load.kind) {
    case 'idle':
    case 'loading':
      return <Loading label={loading} />;
    case 'error': {
      const quotaExceeded = load.error instanceof ApiError && load.error.status === 429;
      return (
        <p className={`notice ${quotaExceeded ? 'notice-warn' : 'notice-error'}`} role="alert">
          <AlertIcon />
          {describeError(load.error, t, limit)}
        </p>
      );
    }
    case 'ready':
      return <>{children(load.report)}</>;
  }
}
