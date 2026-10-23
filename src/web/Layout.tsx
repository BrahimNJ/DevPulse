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
  const { t, locale } = useI18n();
  const allowance = describeQuota(quota, t, locale);

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
            {allowance !== null && (
              <span
                className={`quota-pill${quota?.remaining === 0 ? ' quota-empty' : ''}`}
                title={
                  quota?.limit === null || quota?.limit === undefined
                    ? undefined
                    : interpolate(t.quota.tooltip, { limit: quota.limit })
                }
              >
                <span className="quota-dot" aria-hidden="true" />
                {allowance}
              </span>
            )}
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

/** EN | FR. Each option names its language in that language, for whoever needs it. */
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
          aria-label={LOCALES[option].label}
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
