import type { JSX, ReactNode } from 'react';

import { Layout, REPOSITORY_URL } from './Layout.tsx';
import { useQuota } from './quota.ts';

interface DocSection {
  readonly id: string;
  readonly title: string;
  readonly body: ReactNode;
}

const DECISIONS = `${REPOSITORY_URL}/tree/main/docs/decisions`;

/** A two-column table: what was chosen, and why. */
function Choices({ rows }: { readonly rows: readonly (readonly [string, string])[] }): JSX.Element {
  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th scope="col">Choice</th>
          <th scope="col">Why</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([choice, why]) => (
          <tr key={choice}>
            <th scope="row">{choice}</th>
            <td>{why}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SECTIONS: readonly DocSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <>
        <p>
          DevPulse analyses public GitHub repositories. Its first analysis, the branch report, is
          available as a web application and as a command-line tool. The project is also a showcase
          of how a small product is designed, secured, tested, automated and run in production by
          one engineer working with an AI coding agent.
        </p>
        <p>
          Every technical decision is recorded as an{' '}
          <a href={DECISIONS}>Architecture Decision Record</a> with the alternatives that were
          rejected. This page summarises them; the records hold the details.
        </p>
      </>
    ),
  },
  {
    id: 'architecture',
    title: 'Architecture',
    body: (
      <>
        <div className="diagram" aria-label="Architecture diagram">
          <div className="diagram-node">Browser</div>
          <div className="diagram-arrow">HTTPS</div>
          <div className="diagram-node diagram-main">
            Cloud Run
            <small>Node.js server · React build · API</small>
          </div>
          <div className="diagram-arrow">GraphQL · REST</div>
          <div className="diagram-node">GitHub API</div>
        </div>
        <div className="diagram-side">
          <span>Secret Manager · token and keys</span>
          <span>Firestore · daily allowance</span>
          <span>Cloud Logging · Monitoring</span>
        </div>
        <p>
          The code is layered: a <strong>domain</strong> layer computes the report from plain data
          and an injected clock, an <strong>infrastructure</strong> layer talks to GitHub, and the{' '}
          <strong>interfaces</strong> (web API, React application, CLI) depend on both, never the
          reverse. This is why the business rules are tested without any network.
        </p>
      </>
    ),
  },
  {
    id: 'choices',
    title: 'Technical choices',
    body: (
      <Choices
        rows={[
          [
            'TypeScript, strict',
            'Type errors are caught before running; strict mode removes whole classes of bugs.',
          ],
          [
            'Node.js 24 running TypeScript directly',
            'No compile step for the server: what is tested is what runs.',
          ],
          [
            'Node standard library first',
            'HTTP server, tests, compression, crypto: fewer dependencies, smaller attack surface.',
          ],
          [
            'React and Vite',
            'A maintainable interface with a fast build; plain CSS with light and dark themes.',
          ],
          [
            'GitHub GraphQL API',
            '100 branches with their last commit and divergence per request, instead of one REST call per branch.',
          ],
          [
            'Docker, distroless image',
            'One reproducible artefact; no shell or package manager in production.',
          ],
          [
            'Google Cloud Run',
            'Containers that scale to zero: no server to patch and no cost when idle.',
          ],
          [
            'Terraform',
            'The whole cloud project is code, reviewed in pull requests and reproducible.',
          ],
          [
            'GitHub Actions',
            'Checks, builds and deployments live next to the code, pinned and auditable.',
          ],
        ]}
      />
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <>
        <ul className="check-list">
          <li>
            <strong>No secret in the browser or the repository.</strong> The GitHub token lives in
            Secret Manager and is only readable by the server&apos;s own identity.
          </li>
          <li>
            <strong>No long-lived cloud key.</strong> Deployments exchange a short-lived GitHub
            identity token for Google credentials (Workload Identity Federation), and only the main
            branch of this repository is accepted.
          </li>
          <li>
            <strong>Least privilege.</strong> Each service account can do one job: run the server,
            deploy it, or stop billing. None can do the others&apos; work.
          </li>
          <li>
            <strong>Strict HTTP headers.</strong> Content Security Policy without inline code, HSTS,
            no framing, no MIME sniffing, no referrer, no CORS.
          </li>
          <li>
            <strong>Host validation.</strong> The server only answers its own names, which blocks
            DNS rebinding attacks.
          </li>
          <li>
            <strong>Hardened container.</strong> Non-root user, read-only files, no shell, base
            images pinned by digest and scanned for vulnerabilities on every change.
          </li>
          <li>
            <strong>Supply chain.</strong> Every CI action is pinned to a commit, every image is
            signed with a provenance attestation and a bill of materials, and secret scanning runs
            on every pull request.
          </li>
          <li>
            <strong>Privacy.</strong> Client addresses are never logged or stored; the daily
            allowance keeps only a salted hash and the repositories analysed, which expire after 24
            hours and are deleted shortly after.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'abuse',
    title: 'Abuse protection',
    body: (
      <>
        <p>
          All visitors share one GitHub token, so the service protects it in layers, from the
          cheapest to the strictest:
        </p>
        <ol className="numbered">
          <li>
            A 10-minute cache: a popular repository costs one call, however many people open it.
          </li>
          <li>Concurrent requests for the same repository share a single call.</li>
          <li>A per-minute rate limit per client.</li>
          <li>
            Three analyses per visitor per 24 hours, stored server-side, so refreshing the page or
            opening a private window does not reset them. Re-opening a repository is free.
          </li>
          <li>A reserve: below a safety margin of GitHub quota, new reports are refused.</li>
          <li>A timeout, so a huge repository cannot hold the server.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'github',
    title: 'Working through GitHub',
    body: (
      <>
        <p>Every change, however small, follows the same path:</p>
        <ol className="flow">
          <li>An issue describes the problem.</li>
          <li>A branch named after the type of change is created from main.</li>
          <li>Commits follow Conventional Commits and explain why, one concern each.</li>
          <li>A pull request uses a template and is reviewed; main is never pushed to directly.</li>
          <li>
            release-please reads the commits, writes the changelog and proposes the next version.
          </li>
        </ol>
        <p>
          Git hooks format and lint staged files and check commit messages before anything leaves
          the machine; CI runs the same checks again on GitHub.
        </p>
      </>
    ),
  },
  {
    id: 'delivery',
    title: 'Automation and delivery',
    body: (
      <>
        <Choices
          rows={[
            [
              'On every pull request',
              'Formatting, linting, types, tests, commit messages, dependency audit, secret scan, container build and vulnerability scan, infrastructure validation.',
            ],
            [
              'On every merge to main',
              'The image is built once, signed, pushed, deployed to a private staging service and smoke tested.',
            ],
            [
              'On every release',
              'After the maintainer approves, the same image is deployed to production without traffic, checked, then switched on; a failed check switches back automatically.',
            ],
            ['Every week', 'Dependabot proposes updates of dependencies, actions and base images.'],
          ]}
        />
        <p>
          Building once and promoting the same image means production runs exactly what was tested
          in staging.
        </p>
      </>
    ),
  },
  {
    id: 'deployment',
    title: 'Deployment and cost',
    body: (
      <>
        <p>
          The service runs on Cloud Run in Europe, scaled to zero when nobody uses it, sized to stay
          within Google Cloud&apos;s free tier. Infrastructure is described in Terraform: services,
          registry, identities, secrets, database, monitoring and budget.
        </p>
        <ul className="check-list">
          <li>An uptime check alerts the maintainer by email if production stops answering.</li>
          <li>Logs are structured, so they can be searched by status, latency and cache use.</li>
          <li>
            A monthly budget emails at 10%, 50% and 100%, and a small function detaches billing from
            the project when the budget is reached: a hard spending stop, verified end to end in
            production without being triggered.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'claude',
    title: 'Working with Claude Code',
    body: (
      <>
        <p>
          The project is built with Claude Code, an AI coding agent, configured in the repository so
          that its behaviour is shared, reviewed and enforced rather than improvised.
        </p>
        <Choices
          rows={[
            [
              'Project instructions',
              'Short rules loaded in every session: scope discipline, workflow, hard limits such as never committing secrets.',
            ],
            [
              'Skills',
              'Repeatable workflows as commands: create an issue, start work, check, commit, open a pull request.',
            ],
            [
              'Subagents',
              'Specialists with their own context and minimal tools: a code reviewer, an explorer, a writer of decision records.',
            ],
            [
              'Hooks',
              'Checks the harness enforces itself: protected files cannot be edited, edited files are formatted.',
            ],
            [
              'Human in the loop',
              'Plans are approved before edits, and cloud changes and production releases are applied by the maintainer.',
            ],
          ]}
        />
        <p>
          Every pull request is reviewed by a review subagent before it is opened; its findings and
          the fixes they led to are recorded in each pull request.
        </p>
      </>
    ),
  },
  {
    id: 'tokens',
    title: 'Token optimisation',
    body: (
      <>
        <h3>Claude</h3>
        <ul className="check-list">
          <li>
            Instructions loaded on every request stay short and link to documents instead of copying
            them.
          </li>
          <li>
            Wide searches and reviews run in subagents, so their output never fills the main
            context.
          </li>
          <li>
            Cheaper models do mechanical work; the strongest model is kept for design and review.
          </li>
          <li>
            Files are read by range, and hooks and quality gates do the checking, not extra turns.
          </li>
          <li>
            Unrelated tasks start from a cleared context; long sessions are compacted with a focus.
          </li>
        </ul>
        <h3>GitHub API</h3>
        <ul className="check-list">
          <li>One GraphQL request returns 100 branches with their last commit and divergence.</li>
          <li>Protection comes from one filtered REST listing instead of one call per branch.</li>
          <li>Results are cached for 10 minutes and shared between concurrent visitors.</li>
          <li>The remaining quota is read from every response, and a reserve is never spent.</li>
          <li>Each visitor has a daily allowance; repositories already analysed are free.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'decisions',
    title: 'Decision records',
    body: (
      <>
        <p>
          The records explain the context, the decision, the alternatives and the consequences of
          every structural choice: language and tooling, the AI workflow, releases, the command
          line, the dashboard, the public deployment, and the visitor allowance.
        </p>
        <a className="button button-primary" href={DECISIONS}>
          Read the decision records
        </a>
      </>
    ),
  },
];

export function Docs(): JSX.Element {
  const { quota } = useQuota();
  return (
    <Layout page="docs" quota={quota}>
      <section className="app-hero docs-hero">
        <div className="container">
          <span className="kicker">Documentation</span>
          <h1>How DevPulse is built</h1>
          <p className="lede">
            Technical choices and why they were made, security, automation, deployment, and how an
            AI coding agent is used responsibly. A public summary; the repository holds the full
            details.
          </p>
        </div>
      </section>
      <div className="container docs-layout">
        <nav className="docs-nav" aria-label="On this page">
          <span className="docs-nav-title">On this page</span>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="docs-content">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="doc-section">
              <h2>
                <a href={`#${section.id}`} className="anchor" aria-hidden="true">
                  #
                </a>
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </article>
      </div>
    </Layout>
  );
}
