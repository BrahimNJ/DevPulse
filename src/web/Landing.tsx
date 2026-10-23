import { useState, type JSX, type SyntheticEvent } from 'react';

import { countByStatus, FEATURE_GROUPS, type Feature, type FeatureGroup } from './features.ts';
import { interpolate } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import {
  ArrowIcon,
  BookIcon,
  BranchIcon,
  CheckIcon,
  CloudIcon,
  CodeIcon,
  FeatureIconView,
  RocketIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from './icons.tsx';
import { Layout, REPOSITORY_URL } from './Layout.tsx';
import { useQuota } from './quota.ts';

const AUDIENCE_ICONS = [
  <UserIcon key="user" />,
  <BranchIcon key="branch" />,
  <CodeIcon key="code" />,
];
const PILLAR_ICONS = [
  <ShieldIcon key="shield" />,
  <RocketIcon key="rocket" />,
  <CloudIcon key="cloud" />,
];
const ROADMAP_GROUPS: readonly (readonly FeatureGroup['id'][])[] = [
  ['branches'],
  ['activity', 'contributors'],
  ['collaboration', 'insights'],
];
const EXAMPLES = ['nodejs/node', 'facebook/react', 'vitejs/vite'] as const;

export function Landing(): JSX.Element {
  const { quota } = useQuota();
  return (
    <Layout page="home" quota={quota}>
      <Hero />
      <Audiences />
      <Features />
      <HowItWorks />
      <Engineering />
      <Roadmap />
      <CallToAction />
    </Layout>
  );
}

function Hero(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home;
  const [repository, setRepository] = useState('');

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    const trimmed = repository.trim();
    window.location.assign(trimmed === '' ? '/app' : `/app?repo=${encodeURIComponent(trimmed)}`);
  }

  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="pulse-dot" aria-hidden="true" /> {copy.eyebrow}
          </span>
          <h1>
            {copy.titleBefore} <span className="gradient-text">{copy.titleAccent}</span>{' '}
            {copy.titleAfter}
          </h1>
          <p className="lede">{copy.lede}</p>
          <form className="hero-search" onSubmit={onSubmit} role="search">
            <label className="input-with-icon">
              <SearchIcon />
              <span className="visually-hidden">{copy.repositoryLabel}</span>
              <input
                value={repository}
                onChange={(event) => {
                  setRepository(event.target.value);
                }}
                placeholder={copy.placeholder}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <button type="submit" className="button button-primary">
              {copy.analyse} <ArrowIcon />
            </button>
          </form>
          <p className="hero-hint">
            {copy.try}{' '}
            {EXAMPLES.map((example) => (
              <a key={example} className="chip" href={`/app?repo=${example}`}>
                {example}
              </a>
            ))}
            <span className="muted"> · {copy.freeAnalyses}</span>
          </p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** A static preview of a report, so the page explains itself before any request. */
function HeroPreview(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.preview;
  const rows = [
    { name: 'main', divergence: '—', tone: 'ok' },
    { name: 'v22.x', divergence: '+3968 / −8130', tone: 'info' },
    { name: 'fix/flaky-test', divergence: '+3 / −41', tone: 'ok' },
    { name: 'old-experiment', divergence: '+12 / −48', tone: 'warn' },
  ] as const;
  return (
    <figure className="preview-card" aria-label={copy.label}>
      <div className="window-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <code>{copy.window}</code>
      </div>
      <div className="preview-tiles">
        <div>
          <strong>55</strong>
          <span>{copy.branches}</span>
        </div>
        <div>
          <strong>44</strong>
          <span>{copy.protected}</span>
        </div>
        <div className="tone-warn">
          <strong>37</strong>
          <span>{copy.stale}</span>
        </div>
      </div>
      <div className="meter" aria-hidden="true">
        <span className="meter-fill" />
      </div>
      <table className="preview-table">
        <thead>
          <tr>
            {copy.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.name}>
              <td className="mono">{row.name}</td>
              <td>{copy.rows[index]?.age}</td>
              <td className="mono">{row.divergence}</td>
              <td>
                <span className={`badge badge-${row.tone}`}>{copy.rows[index]?.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="preview-caption">{copy.caption}</figcaption>
    </figure>
  );
}

function Audiences(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.audiences;
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} />
        <ul className="card-grid card-grid-3">
          {copy.items.map((audience, index) => (
            <li key={audience.title} className="card">
              <span className="card-icon">{AUDIENCE_ICONS[index]}</span>
              <h3>{audience.title}</h3>
              <p>{audience.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Features(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.features;
  return (
    <section id="features" className="section section-tinted">
      <div className="container">
        <SectionHeading
          kicker={copy.kicker}
          title={copy.title}
          text={interpolate(copy.summary, {
            live: countByStatus('available'),
            planned: countByStatus('planned'),
          })}
        />
        <div className="feature-groups">
          {FEATURE_GROUPS.map((group) => (
            <FeatureGroupView key={group.id} group={group} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGroupView({ group }: { readonly group: FeatureGroup }): JSX.Element {
  const { t } = useI18n();
  const copy = t.catalogue.groups[group.id];
  const live = group.features.every((feature) => feature.status === 'available');
  return (
    <article className={`feature-group${live ? ' feature-group-live' : ''}`}>
      <header>
        <h3>{copy.name}</h3>
        <p>{copy.summary}</p>
      </header>
      <ul>
        {group.features.map((feature) => (
          <FeatureItem key={feature.id} feature={feature} />
        ))}
      </ul>
    </article>
  );
}

function FeatureItem({ feature }: { readonly feature: Feature }): JSX.Element {
  const { t } = useI18n();
  const copy = t.catalogue.features[feature.id];
  return (
    <li className="feature-item">
      <span className="feature-icon">
        <FeatureIconView name={feature.icon} />
      </span>
      <span>
        <strong>{copy.title}</strong>
        <span className="feature-description">{copy.description}</span>
      </span>
      {feature.status === 'available' ? (
        <span className="badge badge-ok">
          <CheckIcon /> {t.catalogue.live}
        </span>
      ) : (
        <span className="badge badge-muted">{t.catalogue.planned}</span>
      )}
    </li>
  );
}

function HowItWorks(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.how;
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} />
        <ol className="steps">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="terminal" aria-label={copy.terminalLabel}>
          <div className="window-bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <code>terminal</code>
          </div>
          <pre lang="en">
            <code>
              <span className="prompt">$</span> npm run devpulse -- branches nodejs/node{'\n'}
              <span className="muted">nodejs/node: 55 branches, default main</span>
              {'\n'}
              <span className="muted">Protected: 44. Stale (no commit for 90+ days): 37.</span>
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function Engineering(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.engineering;
  return (
    <section id="engineering" className="section section-dark">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} text={copy.text} />
        <ul className="facts">
          {copy.facts.map((fact) => (
            <li key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
        <ol className="pipeline" aria-label={copy.pipelineLabel}>
          {copy.pipeline.map((stage) => (
            <li key={stage.label}>
              <strong>{stage.label}</strong>
              <span>{stage.detail}</span>
            </li>
          ))}
        </ol>
        <ul className="card-grid card-grid-3 pillars">
          {copy.pillars.map((pillar, index) => (
            <li key={pillar.title} className="card card-dark">
              <span className="card-icon">{PILLAR_ICONS[index]}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </li>
          ))}
        </ul>
        <a className="button button-light" href="/docs">
          <BookIcon /> {copy.docs}
        </a>
      </div>
    </section>
  );
}

function Roadmap(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.roadmap;
  return (
    <section id="roadmap" className="section">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} />
        <ol className="roadmap">
          {copy.stages.map((column, index) => (
            <li key={column.stage} className="roadmap-column">
              <span className="roadmap-stage">{column.stage}</span>
              <span className={`badge ${index === 0 ? 'badge-ok' : 'badge-muted'}`}>
                {column.label}
              </span>
              <ul>
                {(ROADMAP_GROUPS[index] ?? []).map((id) => (
                  <li key={id}>{t.catalogue.groups[id].name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CallToAction(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.cta;
  return (
    <section className="section">
      <div className="container">
        <div className="cta">
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.text}</p>
          </div>
          <div className="cta-actions">
            <a className="button button-primary" href="/app?repo=nodejs/node">
              {copy.primary} <ArrowIcon />
            </a>
            <a className="button button-ghost" href={REPOSITORY_URL}>
              {copy.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  kicker,
  title,
  text,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly text?: string;
}): JSX.Element {
  return (
    <div className="section-heading">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {text !== undefined && <p>{text}</p>}
    </div>
  );
}
