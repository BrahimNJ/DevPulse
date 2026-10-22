import { useState, type JSX, type SyntheticEvent } from 'react';

import { countByStatus, FEATURE_GROUPS, type Feature, type FeatureGroup } from './features.ts';
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

const AUDIENCES = [
  {
    icon: <UserIcon />,
    title: 'Recruiters and managers',
    text: 'See in one screen whether a project is alive, organised and well kept, without reading code.',
  },
  {
    icon: <BranchIcon />,
    title: 'Maintainers',
    text: 'Find abandoned branches, work that drifted from main, and what is safe to clean up.',
  },
  {
    icon: <CodeIcon />,
    title: 'Developers',
    text: 'Read how a small product is designed, secured, tested and shipped: everything is public.',
  },
] as const;

const STEPS = [
  {
    title: 'Name a repository',
    text: 'Type any public owner/repository, pick one of the examples, or open a shared link.',
  },
  {
    title: 'DevPulse reads GitHub',
    text: 'The server queries the GraphQL and REST APIs with its own token, which never reaches your browser.',
  },
  {
    title: 'Read the health report',
    text: 'Indicators first, then every branch: age, author, protection and divergence from main.',
  },
] as const;

/** Facts about the project itself, each checkable in the repository. */
const FACTS = [
  { value: '0 €', label: 'monthly cost, by design and by a billing kill switch' },
  { value: '0', label: 'long-lived cloud keys: deployments use federated identity' },
  { value: '100+', label: 'automated tests, run on every change' },
  { value: '1', label: 'click to approve a release; the rest is automated' },
] as const;

const PIPELINE = [
  { label: 'Pull request', detail: 'lint · types · tests · image scan' },
  { label: 'Merge to main', detail: 'build once · sign · deploy staging' },
  { label: 'Smoke test', detail: 'health · interface · real report' },
  { label: 'Approval', detail: 'maintainer reviews the release' },
  { label: 'Production', detail: 'no-traffic check · switch · rollback' },
] as const;

const ROADMAP = [
  { stage: 'Now', label: 'Live', groups: ['branches'] },
  { stage: 'Next', label: 'Planned', groups: ['activity', 'contributors'] },
  { stage: 'Later', label: 'Planned', groups: ['collaboration', 'insights'] },
] as const;

const EXAMPLES = ['nodejs/node', 'facebook/react', 'vitejs/vite'] as const;

function groupName(id: string): string {
  return FEATURE_GROUPS.find((group) => group.id === id)?.name ?? id;
}

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
            <span className="pulse-dot" aria-hidden="true" /> Open source · live on Google Cloud
          </span>
          <h1>
            Take the <span className="gradient-text">pulse</span> of any GitHub repository
          </h1>
          <p className="lede">
            DevPulse turns the branches of a public repository into a clear health report: what is
            active, what is protected, what was abandoned and what drifted away from main.
          </p>
          <form className="hero-search" onSubmit={onSubmit} role="search">
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
            <button type="submit" className="button button-primary">
              Analyse <ArrowIcon />
            </button>
          </form>
          <p className="hero-hint">
            Try{' '}
            {EXAMPLES.map((example) => (
              <a key={example} className="chip" href={`/app?repo=${example}`}>
                {example}
              </a>
            ))}
            <span className="muted"> · 3 free analyses a day</span>
          </p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** A static preview of a report, so the page explains itself before any request. */
function HeroPreview(): JSX.Element {
  const rows = [
    { name: 'main', age: 'today', divergence: '—', status: 'default', tone: 'ok' },
    { name: 'v22.x', age: '1 day', divergence: '+3968 / −8130', status: 'protected', tone: 'info' },
    {
      name: 'fix/flaky-test',
      age: '12 days',
      divergence: '+3 / −41',
      status: 'active',
      tone: 'ok',
    },
    {
      name: 'old-experiment',
      age: '1.8 years',
      divergence: '+12 / −48',
      status: 'stale',
      tone: 'warn',
    },
  ] as const;
  return (
    <figure className="preview-card" aria-label="Example of a report">
      <div className="window-bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <code>DevPulse · nodejs/node</code>
      </div>
      <div className="preview-tiles">
        <div>
          <strong>55</strong>
          <span>branches</span>
        </div>
        <div>
          <strong>44</strong>
          <span>protected</span>
        </div>
        <div className="tone-warn">
          <strong>37</strong>
          <span>stale</span>
        </div>
      </div>
      <div className="meter" aria-hidden="true">
        <span className="meter-fill" />
      </div>
      <table className="preview-table">
        <thead>
          <tr>
            <th scope="col">Branch</th>
            <th scope="col">Last commit</th>
            <th scope="col">Ahead / behind</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="mono">{row.name}</td>
              <td>{row.age}</td>
              <td className="mono">{row.divergence}</td>
              <td>
                <span className={`badge badge-${row.tone}`}>{row.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="preview-caption">Illustrative figures</figcaption>
    </figure>
  );
}

function Audiences(): JSX.Element {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker="Who it is for" title="One report, read in two minutes" />
        <ul className="card-grid card-grid-3">
          {AUDIENCES.map((audience) => (
            <li key={audience.title} className="card">
              <span className="card-icon">{audience.icon}</span>
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
  return (
    <section id="features" className="section section-tinted">
      <div className="container">
        <SectionHeading
          kicker="Features"
          title="Everything about the health of a repository"
          text={`${String(countByStatus('available'))} analyses are live today and ${String(countByStatus('planned'))} are on the roadmap, each marked as such.`}
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
  const live = group.features.every((feature) => feature.status === 'available');
  return (
    <article className={`feature-group${live ? ' feature-group-live' : ''}`}>
      <header>
        <h3>{group.name}</h3>
        <p>{group.summary}</p>
      </header>
      <ul>
        {group.features.map((feature) => (
          <FeatureItem key={feature.title} feature={feature} />
        ))}
      </ul>
    </article>
  );
}

function FeatureItem({ feature }: { readonly feature: Feature }): JSX.Element {
  return (
    <li className="feature-item">
      <span className="feature-icon">
        <FeatureIconView name={feature.icon} />
      </span>
      <span>
        <strong>{feature.title}</strong>
        <span className="feature-description">{feature.description}</span>
      </span>
      {feature.status === 'available' ? (
        <span className="badge badge-ok">
          <CheckIcon /> Live
        </span>
      ) : (
        <span className="badge badge-muted">Planned</span>
      )}
    </li>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker="How it works" title="From a name to a report in seconds" />
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="step">
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="terminal" aria-label="The same report from the command line">
          <div className="window-bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <code>terminal</code>
          </div>
          <pre>
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
  return (
    <section id="engineering" className="section section-dark">
      <div className="container">
        <SectionHeading
          kicker="Engineering"
          title="Built and run like a production service"
          text="Every choice is written down, automated and checked. The documentation explains each one."
        />
        <ul className="facts">
          {FACTS.map((fact) => (
            <li key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
        <ol className="pipeline" aria-label="Delivery pipeline">
          {PIPELINE.map((stage) => (
            <li key={stage.label}>
              <strong>{stage.label}</strong>
              <span>{stage.detail}</span>
            </li>
          ))}
        </ol>
        <ul className="card-grid card-grid-3 pillars">
          <li className="card card-dark">
            <span className="card-icon">
              <ShieldIcon />
            </span>
            <h3>Secure by default</h3>
            <p>Strict headers, no key to leak, a token the browser never sees, abuse limits.</p>
          </li>
          <li className="card card-dark">
            <span className="card-icon">
              <RocketIcon />
            </span>
            <h3>Fully automated</h3>
            <p>From pull request to production: checks, signed builds, staging and rollback.</p>
          </li>
          <li className="card card-dark">
            <span className="card-icon">
              <CloudIcon />
            </span>
            <h3>Free to run</h3>
            <p>Serverless, scaled to zero, sized for the free tier, with a hard spending stop.</p>
          </li>
        </ul>
        <a className="button button-light" href="/docs">
          <BookIcon /> Read the engineering docs
        </a>
      </div>
    </section>
  );
}

function Roadmap(): JSX.Element {
  return (
    <section id="roadmap" className="section">
      <div className="container">
        <SectionHeading kicker="Roadmap" title="Where DevPulse is going" />
        <ol className="roadmap">
          {ROADMAP.map((column) => (
            <li key={column.stage} className="roadmap-column">
              <span className="roadmap-stage">{column.stage}</span>
              <span className={`badge ${column.stage === 'Now' ? 'badge-ok' : 'badge-muted'}`}>
                {column.label}
              </span>
              <ul>
                {column.groups.map((id) => (
                  <li key={id}>{groupName(id)}</li>
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
  return (
    <section className="section">
      <div className="container">
        <div className="cta">
          <div>
            <h2>See a repository&apos;s pulse now</h2>
            <p>Three free analyses a day, no account, nothing to install.</p>
          </div>
          <div className="cta-actions">
            <a className="button button-primary" href="/app?repo=nodejs/node">
              Analyse nodejs/node <ArrowIcon />
            </a>
            <a className="button button-ghost" href={REPOSITORY_URL}>
              View the source
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
