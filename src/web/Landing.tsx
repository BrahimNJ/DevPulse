import { m, useReducedMotion, type Variants } from 'motion/react';
import { useId, useState, type JSX, type SyntheticEvent } from 'react';

import { countByStatus, FEATURE_GROUPS, type Feature, type FeatureGroup } from './features.ts';
import { formatNumber, interpolate } from './i18n.ts';
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
import { CountUp, EASE_OUT, GrowBar, Reveal, RevealItem, RevealList } from './motion.tsx';
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
  ['branches', 'collaboration'],
  ['activity', 'contributors'],
  ['security', 'insights'],
];
const EXAMPLES = ['nodejs/node', 'facebook/react', 'vitejs/vite'] as const;

/** The hero enters line by line once, on load rather than on scroll. */
const HERO_LINES: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const HERO_LINE: Variants = {
  hidden: { opacity: 0, y: 22 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
};

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
      <HeroSignal />
      <div className="container hero-grid">
        <m.div className="hero-copy" variants={HERO_LINES} initial="hidden" animate="shown">
          <m.span className="eyebrow" variants={HERO_LINE}>
            <span className="pulse-dot" aria-hidden="true" /> {copy.eyebrow}
          </m.span>
          <m.h1 variants={HERO_LINE}>
            {copy.titleBefore} <span className="gradient-text">{copy.titleAccent}</span>{' '}
            {copy.titleAfter}
          </m.h1>
          <m.p className="lede" variants={HERO_LINE}>
            {copy.lede}
          </m.p>
          <m.form className="hero-search" onSubmit={onSubmit} role="search" variants={HERO_LINE}>
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
          </m.form>
          <m.p className="hero-hint" variants={HERO_LINE}>
            {copy.try}{' '}
            {EXAMPLES.map((example) => (
              <a key={example} className="chip" href={`/app?repo=${example}`}>
                {example}
              </a>
            ))}
            <span className="muted"> · {copy.freeAnalyses}</span>
          </m.p>
        </m.div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Flat line, heartbeat, flat line: the signal the product is named after. */
const SIGNAL =
  'M0 150H300l16-44 24 92 20-70 14 22H700l12-26 18 52 14-34H1060l16-44 24 92 20-70 14 22H1440';

/**
 * The heartbeat behind the hero: drawn once on load, then a short pulse of light runs
 * along it. Decorative; under reduced motion the line is drawn whole and the pulse,
 * a CSS animation, is removed.
 */
function HeroSignal(): JSX.Element {
  const gradient = `${useId()}-signal`;
  const reduced = useReducedMotion() === true;
  return (
    <svg
      className="hero-signal"
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4c9aff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#4c9aff" />
          <stop offset="0.75" stopColor="#5ef0b0" />
          <stop offset="1" stopColor="#5ef0b0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <m.path
        className="hero-signal-line"
        d={SIGNAL}
        stroke={`url(#${gradient})`}
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
      />
      <path className="hero-signal-run" d={SIGNAL} pathLength={1000} />
    </svg>
  );
}

/** The weekly merges drawn in the preview: shaped like a busy repository. */
const PREVIEW_WEEKS = [34, 41, 38, 52, 47, 44, 58, 61, 55, 63, 70, 66] as const;

/** A preview of a report, so the page explains itself before any request. */
function HeroPreview(): JSX.Element {
  const { t, locale } = useI18n();
  const copy = t.home.preview;
  const count = (value: number): string => formatNumber(value, locale);
  const rows = [
    { name: 'main', divergence: '—', tone: 'ok' },
    { name: 'v22.x', divergence: '+3968 / −8130', tone: 'info' },
    { name: 'fix/flaky-test', divergence: '+3 / −41', tone: 'ok' },
    { name: 'old-experiment', divergence: '+12 / −48', tone: 'warn' },
  ] as const;
  const max = Math.max(...PREVIEW_WEEKS);
  return (
    <m.figure
      className="preview-card"
      aria-label={copy.label}
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 }}
    >
      <div className="window-bar">
        <span className="live-dot" aria-hidden="true" />
        <code>{copy.window}</code>
      </div>
      <div className="preview-tiles">
        <div>
          <strong>
            <CountUp value={55} format={count} />
          </strong>
          <span>{copy.branches}</span>
        </div>
        <div>
          <strong>
            <CountUp value={44} format={count} />
          </strong>
          <span>{copy.protected}</span>
        </div>
        <div className="tone-warn">
          <strong>
            <CountUp value={37} format={count} />
          </strong>
          <span>{copy.stale}</span>
        </div>
      </div>
      <svg
        className="preview-spark"
        viewBox="0 0 240 48"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {PREVIEW_WEEKS.map((week, index) => (
          <m.rect
            key={index}
            x={index * 20 + 3}
            y={48 - (week / max) * 44}
            width={14}
            height={(week / max) * 44}
            rx={2}
            className={index >= PREVIEW_WEEKS.length - 4 ? 'bar bar-recent' : 'bar'}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.7 + index * 0.04 }}
          />
        ))}
      </svg>
      <div className="meter" aria-hidden="true">
        <GrowBar className="meter-fill" share={0.33} delay={0.9} />
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
            <m.tr
              key={row.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 1 + index * 0.08 }}
            >
              <td className="mono">{row.name}</td>
              <td>{copy.rows[index]?.age}</td>
              <td className="mono">{row.divergence}</td>
              <td>
                <span className={`badge badge-${row.tone}`}>{copy.rows[index]?.status}</span>
              </td>
            </m.tr>
          ))}
        </tbody>
      </table>
      <figcaption className="preview-caption">{copy.caption}</figcaption>
    </m.figure>
  );
}

function Audiences(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.audiences;
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} />
        <RevealList className="card-grid card-grid-3">
          {copy.items.map((audience, index) => (
            <RevealItem key={audience.title} className="card spot">
              <span className="card-icon">{AUDIENCE_ICONS[index]}</span>
              <h3>{audience.title}</h3>
              <p>{audience.text}</p>
            </RevealItem>
          ))}
        </RevealList>
      </div>
    </section>
  );
}

function Features(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.features;
  return (
    <section id="features" className="section section-band">
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
          {FEATURE_GROUPS.map((group, index) => (
            <Reveal key={group.id} delay={(index % 2) * 0.08}>
              <FeatureGroupView group={group} />
            </Reveal>
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
    <article className={`feature-group spot${live ? ' feature-group-live' : ''}`}>
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

const TERMINAL: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.45, delayChildren: 0.2 } },
};
const TERMINAL_LINE: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.3 } },
};

function HowItWorks(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.how;
  return (
    <section className="section">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} />
        <RevealList className="steps" ordered>
          {copy.steps.map((step, index) => (
            <RevealItem key={step.title} className="step spot">
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </RevealItem>
          ))}
        </RevealList>
        <Reveal className="terminal">
          <div className="window-bar" aria-hidden="true">
            <span className="live-dot" />
            <code>terminal</code>
          </div>
          <pre lang="en" aria-label={copy.terminalLabel}>
            <m.code
              variants={TERMINAL}
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, amount: 0.6 }}
            >
              <m.span className="terminal-line" variants={TERMINAL_LINE}>
                <span className="prompt">$</span> npm run devpulse -- branches nodejs/node
              </m.span>
              <m.span className="terminal-line muted" variants={TERMINAL_LINE}>
                nodejs/node: 55 branches, default main
              </m.span>
              <m.span className="terminal-line muted" variants={TERMINAL_LINE}>
                Protected: 44. Stale (no commit for 90+ days): 37.
              </m.span>
            </m.code>
          </pre>
        </Reveal>
      </div>
    </section>
  );
}

function Engineering(): JSX.Element {
  const { t } = useI18n();
  const copy = t.home.engineering;
  return (
    <section id="engineering" className="section section-band">
      <div className="container">
        <SectionHeading kicker={copy.kicker} title={copy.title} text={copy.text} />
        <RevealList className="facts">
          {copy.facts.map((fact) => (
            <RevealItem key={fact.label} className="spot">
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </RevealItem>
          ))}
        </RevealList>
        <RevealList className="pipeline" ordered label={copy.pipelineLabel}>
          {copy.pipeline.map((stage) => (
            <RevealItem key={stage.label}>
              <strong>{stage.label}</strong>
              <span>{stage.detail}</span>
            </RevealItem>
          ))}
        </RevealList>
        <RevealList className="card-grid card-grid-3 pillars">
          {copy.pillars.map((pillar, index) => (
            <RevealItem key={pillar.title} className="card spot">
              <span className="card-icon">{PILLAR_ICONS[index]}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </RevealItem>
          ))}
        </RevealList>
        <a className="button button-ghost" href="/docs">
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
        <RevealList className="roadmap" ordered>
          {copy.stages.map((column, index) => (
            <RevealItem
              key={column.stage}
              className={`roadmap-column spot${index === 0 ? ' roadmap-now' : ''}`}
            >
              <span className="roadmap-stage">{column.stage}</span>
              <span className={`badge ${index === 0 ? 'badge-ok' : 'badge-muted'}`}>
                {column.label}
              </span>
              <ul>
                {(ROADMAP_GROUPS[index] ?? []).map((id) => (
                  <li key={id}>{t.catalogue.groups[id].name}</li>
                ))}
              </ul>
            </RevealItem>
          ))}
        </RevealList>
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
        <Reveal className="cta">
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
        </Reveal>
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
    <Reveal className="section-heading">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {text !== undefined && <p>{text}</p>}
    </Reveal>
  );
}
