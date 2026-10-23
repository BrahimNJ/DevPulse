import { useEffect, type JSX, type ReactNode } from 'react';

import type { QuotaResponse } from './api.ts';
import { interpolate, LOCALES, type Locale, type Messages } from './i18n.ts';
import { useI18n } from './I18nProvider.tsx';
import { GitHubIcon, Logo } from './icons.tsx';
import { describeQuota } from './quota.ts';

export type Page = 'home' | 'app' | 'docs' | 'owner';

const NAVIGATION: readonly {
  readonly page: Page;
  readonly href: string;
  readonly label: (t: Messages) => string;
}[] = [
  { page: 'home', href: '/', label: (t) => t.nav.product },
  { page: 'app', href: '/app', label: (t) => t.nav.analyse },
  { page: 'docs', href: '/docs', label: (t) => t.nav.docs },
];

export const REPOSITORY_URL = 'https://github.com/BrahimNJ/DevPulse';

export function Layout({
  page,
  quota,
  children,
}: {
  readonly page: Page;
  readonly quota: QuotaResponse | null;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useI18n();

  useEffect(() => {
    document.title = t.meta.titles[page];
  }, [t, page]);

  // Pages render in the browser, after it has tried to scroll to a #section link.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id !== '') {
      document.getElementById(id)?.scrollIntoView();
    }
  }, []);

  return (
    <div className="site">
      <a className="skip-link" href="#content">
        {t.nav.skip}
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label={t.nav.home}>
            <Logo size={30} />
            <span className="brand-name">
              Dev<span className="brand-accent">Pulse</span>
            </span>
          </a>
          <nav className="site-nav" aria-label={t.nav.main}>
            {NAVIGATION.map((item) => (
              <a
                key={item.page}
                href={item.href}
                className="nav-link"
                aria-current={item.page === page ? 'page' : undefined}
              >
                {item.label(t)}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <QuotaPill quota={quota} />
            <LanguageSwitch />
            <a className="icon-link" href={REPOSITORY_URL} aria-label={t.nav.source}>
              <GitHubIcon />
            </a>
          </div>
        </div>
      </header>

      <main id="content">{children}</main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <a className="brand" href="/">
              <Logo size={26} />
              <span className="brand-name">
                Dev<span className="brand-accent">Pulse</span>
              </span>
            </a>
            <p>{t.footer.tagline}</p>
          </div>
          <FooterColumn
            title={t.footer.product}
            links={[
              [t.footer.overview, '/'],
              [t.footer.analyse, '/app'],
              [t.footer.roadmap, '/#roadmap'],
            ]}
          />
          <FooterColumn
            title={t.footer.engineering}
            links={[
              [t.footer.documentation, '/docs'],
              [t.footer.security, '/docs#security'],
              [t.footer.delivery, '/docs#delivery'],
            ]}
          />
          <FooterColumn
            title={t.footer.source}
            links={[
              [t.footer.repository, REPOSITORY_URL],
              [t.footer.decisions, `${REPOSITORY_URL}/tree/main/docs/decisions`],
              [t.footer.releases, `${REPOSITORY_URL}/releases`],
            ]}
          />
        </div>
        <div className="container footer-bottom">
          <span>{t.footer.data}</span>
          <span className="mono">TypeScript · React · Node.js · Cloud Run · Terraform</span>
        </div>
      </footer>
    </div>
  );
}

/** The visitor's daily allowance; nothing when there is none. */
function QuotaPill({ quota }: { readonly quota: QuotaResponse | null }): JSX.Element | null {
  const { t, locale } = useI18n();
  const allowance = describeQuota(quota, t, locale);
  if (quota === null || allowance === null) {
    return null;
  }
  const compact = quota.owner ? '∞' : `${String(quota.remaining)}/${String(quota.limit)}`;
  return (
    <span
      className={`quota-pill${quota.remaining === 0 ? ' quota-empty' : ''}`}
      title={
        quota.limit === null ? undefined : interpolate(t.quota.tooltip, { limit: quota.limit })
      }
    >
      <span className="quota-dot" aria-hidden="true" />
      {/* Phones show the compact form; screen readers always get the sentence. */}
      <span className="quota-full">{allowance}</span>
      <span className="quota-compact" aria-hidden="true">
        {compact}
      </span>
    </span>
  );
}

/**
 * FR | EN. The visible code is the accessible name (WCAG 2.5.3, label in name); the
 * full language name, in that language, is the tooltip.
 */
function LanguageSwitch(): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const options: readonly Locale[] = ['fr', 'en'];
  return (
    <div className="language-switch" role="group" aria-label={t.nav.language}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          title={LOCALES[option].label}
          onClick={() => {
            setLocale(option);
          }}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  readonly title: string;
  readonly links: readonly (readonly [string, string])[];
}): JSX.Element {
  return (
    <div className="footer-column">
      <h2>{title}</h2>
      <ul>
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
