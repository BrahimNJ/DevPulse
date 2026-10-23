# 0010. Measure delivery health from public GitHub data

- Status: accepted
- Date: 2026-10-23

## Context

The branch report (ADR 0005) shows the state of a repository, not how its team ships.
Developers, leads and managers compare delivery with the four DORA metrics, which are
normally measured on internal deployment data that a public repository does not expose.
DevPulse runs on a free tier with a daily allowance per visitor (ADR 0008), so a second
feature must stay cheap in GitHub API points and in Cloud Run time (#49).

## Decision

- **Proxies, named as such:** lead time is pull request opening to merge; release
  frequency counts published, non-prerelease GitHub Releases; the change failure rate
  is approximated by merged pull requests whose title contains the word "Revert".
  Time to restore has no public proxy and is left out. The interface and the Docs page
  call these approximations and link to the methodology.
- **DORA bands:** elite, high, medium or low with the published thresholds (lead time
  one day, one week, one month; releases daily, weekly, monthly; failure rate 5, 10,
  15 %). A metric without data, or a repository without any Release, has no band rather
  than a low one.
- **Data:** two GraphQL requests in parallel, 1 point each (measured with
  `rateLimit(dryRun: true)`):
  - a sample of the 100 most recently updated merged pull requests over 90 days, with
    their first five reviews, and the last 50 releases;
  - aliased `search` counts with `first: 0` for merged, abandoned, stale open and
    reverted pull requests and twelve weekly merge counts.

  GitHub cannot order pull requests by merge date; the sample approximates the latest
  merges, while the counts cover the whole window by date.

- **Repositories search does not index** (facebook/react answers 0): the report falls
  back to the sample, marks counts it cannot know as unknown instead of 0, and the
  interface says so.
- **API:** `GET /api/delivery?repo=owner/name`, cached like the branch report, sharing
  the visitor's daily allowance: analysing a repository counts once for both reports.
- **Interface:** the analyser becomes a two-column workspace with Branches and Delivery
  tabs. Both reports load together, so switching tabs is instant. Before a first
  analysis it shows an example report, labelled as illustrative and shaped on
  nodejs/node, so the page is never empty; it costs no request.

## Alternatives considered

- **Only the latest 100 pull requests, without search.** One request, but on a busy
  repository it covers a few days, so weekly throughput and abandonment are wrong.
- **The REST API, page by page.** Exact, but dozens of requests per analysis, beyond
  what the allowance and the free tier allow.
- **Deployments or workflow runs as the deployment signal.** Few open-source projects
  deploy through GitHub Deployments; Releases are the most common public signal.
- **Load the delivery report only when its tab opens.** Saves 2 points when a visitor
  never opens it, but makes the tab wait 5 to 10 seconds; the allowance, not the
  points, is the binding limit.
- **No example before the first analysis.** An empty form is what the redesign set out
  to avoid; a cached real report would go stale and still need labelling.

## Consequences

- Delivery adds 2 GitHub points to each analysis, against 5,000 an hour.
- The metrics are approximations; teams that ship without Releases, or name reverts
  differently, are measured less precisely, and the interface says what it uses.
- First review reads only the first five reviews of each pull request; a human review
  after five bot or author reviews is missed.
- Throughput and abandonment depend on GitHub search, which may not index a repository.
- The example report is bundled into the interface and must stay marked as such.
- Extends ADRs 0005, 0006 and 0008.
