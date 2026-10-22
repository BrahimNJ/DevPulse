import { useEffect, type JSX, type ReactNode } from 'react';

import { GitHubIcon, Logo } from './icons.tsx';
import { describeQuota } from './quota.ts';
import type { QuotaResponse } from './api.ts';

export type Page = 'home' | 'app' | 'docs' | 'owner';

const NAVIGATION: readonly {
  readonly page: Page;
  readonly href: string;
  readonly label: string;
}[] = [
  { page: 'home', href: '/', label: 'Product' },
  { page: 'app', href: '/app', label: 'Analyse' },
  { page: 'docs', href: '/docs', label: 'Docs' },
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
  const allowance = describeQuota(quota);

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
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="/" aria-label="DevPulse home">
            <Logo size={30} />
            <span className="brand-name">
              Dev<span className="brand-accent">Pulse</span>
            </span>
          </a>
          <nav className="site-nav" aria-label="Main">
            {NAVIGATION.map((item) => (
              <a
                key={item.page}
                href={item.href}
                className="nav-link"
                aria-current={item.page === page ? 'page' : undefined}
              >
                {item.label}
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
                    : `Each visitor may analyse ${String(quota.limit)} repositories a day`
                }
              >
                <span className="quota-dot" aria-hidden="true" />
                {allowance}
              </span>
            )}
            <a className="icon-link" href={REPOSITORY_URL} aria-label="Source code on GitHub">
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
            <p>
              Branch health for public GitHub repositories. An open-source portfolio project,
              designed, secured and shipped end to end.
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={[
              ['Overview', '/'],
              ['Analyse a repository', '/app'],
              ['Roadmap', '/#roadmap'],
            ]}
          />
          <FooterColumn
            title="Engineering"
            links={[
              ['Documentation', '/docs'],
              ['Security', '/docs#security'],
              ['Delivery pipeline', '/docs#delivery'],
            ]}
          />
          <FooterColumn
            title="Source"
            links={[
              ['Repository', REPOSITORY_URL],
              ['Decision records', `${REPOSITORY_URL}/tree/main/docs/decisions`],
              ['Releases', `${REPOSITORY_URL}/releases`],
            ]}
          />
        </div>
        <div className="container footer-bottom">
          <span>Data from the GitHub GraphQL and REST APIs.</span>
          <span className="mono">TypeScript · React · Node.js · Cloud Run · Terraform</span>
        </div>
      </footer>
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
