import { useState, type JSX, type SyntheticEvent } from 'react';

import { countByStatus, FEATURE_GROUPS, type Feature, type FeatureGroup } from './features.ts';
import { ArrowIcon, CheckIcon, FeatureIconView, PulseIcon, SearchIcon } from './icons.tsx';

const SOURCE_URL = 'https://github.com/BrahimNJ/DevPulse';

const STEPS = [
  {
    title: 'Name a repository',
    text: 'Type any public owner/repository, or open a shared link.',
  },
  {
    title: 'DevPulse reads GitHub',
    text: 'A local server queries the GraphQL and REST APIs. Your token never leaves your machine.',
  },
  {
    title: 'Read the report',
    text: 'Summary indicators first, then every detail, filterable and shareable.',
  },
] as const;

const ROADMAP = [
  { stage: 'Now', label: 'Released in v0.1', groups: ['branches'] },
  { stage: 'Next', label: 'Planned', groups: ['activity', 'contributors'] },
  { stage: 'Later', label: 'Planned', groups: ['collaboration', 'insights'] },
] as const;

const STACK = [
  'TypeScript',
  'React 19',
  'Vite',
  'Node.js 24',
  'GitHub GraphQL',
  'node:test',
  'GitHub Actions',
  'Claude Code',
] as const;

function groupName(id: string): string {
  return FEATURE_GROUPS.find((group) => group.id === id)?.name ?? id;
}

export function Landing(): JSX.Element {
  return (
    <div className="landing">
      <Navigation />
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <Roadmap />
      <Engineering />
      <CallToAction />
      <footer className="landing-footer">
        <span className="brand brand-small">
          <span className="brand-mark">
            <PulseIcon />
          </span>
          DevPulse
        </span>
        <span>Open source, built with TypeScript. Data from the GitHub API.</span>
        <a href={SOURCE_URL}>Source code</a>
      </footer>
    </div>
  );
}

function Navigation(): JSX.Element {
  return (
    <nav className="nav" aria-label="Main">
      <a className="brand" href="/">
        <span className="brand-mark">
          <PulseIcon />
        </span>
        <span className="brand-name">DevPulse</span>
      </a>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#roadmap">Roadmap</a>
        <a href={SOURCE_URL}>GitHub</a>
      </div>
      <a className="button button-small" href="/app">
        Open the app
      </a>
    </nav>
  );
}

function Hero(): JSX.Element {
  const [repository, setRepository] = useState('');

  function onSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    event.preventDefault();
    const target = repository.trim() === '' ? 'nodejs/node' : repository.trim();
    window.location.assign(`/app?${new URLSearchParams({ repo: target }).toString()}`);
  }

  return (
    <header className="hero-landing">
      <div className="hero-copy">
        <span className="eyebrow">
          <span className="eyebrow-dot" aria-hidden="true" />
          v0.1 · Branch health is live
        </span>
        <h1>
          Understand any GitHub repository <span className="gradient-text">at a glance</span>
        </h1>
        <p className="hero-lede">
          DevPulse turns a repository&apos;s history into clear signals: which branches are alive,
          who keeps the project moving, and how fast work reaches main.
        </p>
        <form className="hero-search" onSubmit={onSubmit} role="search">
          <label className="hero-search-field">
            <SearchIcon />
            <span className="visually-hidden">Repository</span>
            <input
              value={repository}
              onChange={(event) => {
                setRepository(event.target.value);
              }}
              placeholder="nodejs/node"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="button">
            Analyse
            <ArrowIcon />
          </button>
        </form>
        <p className="hero-note">Free and open source. Runs locally with your GitHub token.</p>
      </div>
      <figure className="hero-preview">
        <div className="window-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <span className="window-url">127.0.0.1:5173/app?repo=nodejs/node</span>
        </div>
        <img
          src="/preview.png"
          alt="The DevPulse app showing branch statistics for nodejs/node"
          width="1440"
          height="1040"
        />
      </figure>
    </header>
  );
}

function TrustStrip(): JSX.Element {
  const items = [
    `${String(countByStatus('available'))} features live`,
    `${String(countByStatus('planned'))} on the roadmap`,
    'Token stays on your machine',
    'Strict TypeScript, tested',
  ];
  return (
    <ul className="trust-strip">
      {items.map((item) => (
        <li key={item}>
          <CheckIcon />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Features(): JSX.Element {
  return (
    <section id="features" className="section">
      <div className="section-heading">
        <span className="section-kicker">Features</span>
        <h2>One tool for the health of a repository</h2>
        <p>
          Branch health is available today. The other analyses are on the roadmap and are marked as
          planned until they ship.
        </p>
      </div>
      <div className="feature-groups">
        {FEATURE_GROUPS.map((group) => (
          <FeatureGroupView key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}

function FeatureGroupView({ group }: { readonly group: FeatureGroup }): JSX.Element {
  const live = group.features.every((feature) => feature.status === 'available');
  return (
    <article className={`feature-group ${live ? 'feature-group-live' : ''}`}>
      <header className="feature-group-header">
        <div>
          <h3>{group.name}</h3>
          <p>{group.summary}</p>
        </div>
        <StatusBadge live={live} />
      </header>
      <ul className="feature-cards">
        {group.features.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </ul>
    </article>
  );
}

function FeatureCard({ feature }: { readonly feature: Feature }): JSX.Element {
  return (
    <li className={`feature-card feature-card-${feature.status}`}>
      <span className="feature-icon">
        <FeatureIconView name={feature.icon} />
      </span>
      <h4>{feature.title}</h4>
      <p>{feature.description}</p>
    </li>
  );
}

function StatusBadge({ live }: { readonly live: boolean }): JSX.Element {
  return live ? (
    <span className="status-badge status-live">
      <CheckIcon />
      Available
    </span>
  ) : (
    <span className="status-badge status-planned">Planned</span>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <section id="how" className="section">
      <div className="section-heading">
        <span className="section-kicker">How it works</span>
        <h2>From a name to a report in seconds</h2>
      </div>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="step">
            <span className="step-number">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Roadmap(): JSX.Element {
  return (
    <section id="roadmap" className="section">
      <div className="section-heading">
        <span className="section-kicker">Roadmap</span>
        <h2>Where DevPulse is going</h2>
        <p>Planned items are proposals: each one is specified in an issue before it is built.</p>
      </div>
      <ol className="roadmap">
        {ROADMAP.map((column) => (
          <li
            key={column.stage}
            className={`roadmap-column ${column.stage === 'Now' ? 'roadmap-now' : ''}`}
          >
            <span className="roadmap-stage">{column.stage}</span>
            <span className="roadmap-label">{column.label}</span>
            <ul>
              {column.groups.map((id) => (
                <li key={id}>{groupName(id)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Engineering(): JSX.Element {
  return (
    <section className="section engineering">
      <div className="section-heading">
        <span className="section-kicker">Engineering</span>
        <h2>Built like a production product</h2>
        <p>
          Layered architecture, strict types, automated quality gates on every pull request, and
          every technical decision recorded with its alternatives.
        </p>
      </div>
      <ul className="stack">
        {STACK.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a className="text-link" href={SOURCE_URL}>
        Read the code and the decision records <ArrowIcon />
      </a>
    </section>
  );
}

function CallToAction(): JSX.Element {
  return (
    <section className="cta">
      <h2>See your repository&apos;s pulse</h2>
      <p>Branch health is ready today. Try it on a project you know.</p>
      <a className="button button-light" href="/app?repo=nodejs/node">
        Open the app
        <ArrowIcon />
      </a>
    </section>
  );
}
