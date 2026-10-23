# 0011. Record anonymous analysis events for the owner's statistics

- Status: accepted
- Date: 2026-10-24

## Context

The maintainer has no view of how the public site is used: how many visitors come,
which repositories they analyse, and why analyses fail. These answers decide what to
improve, such as the daily allowance (ADR 0008), the examples or the timeouts (#54).
Request logs exist in Cloud Logging, but reading them needs console access and gives
no summary. The site runs on free tiers and must not collect personal data it does not
need.

## Decision

- **One event per analysis**, written to a Firestore `events` collection before the
  answer is sent, because Cloud Run may throttle an instance once it has answered. It
  holds:
  - the time;
  - the report (branches or delivery) and the repository;
  - the salted visitor hash of ADR 0008, never the address;
  - whether the owner made it;
  - the status and an outcome derived from it;
  - the duration and whether the cache answered;
  - a coarse device class (mobile, desktop, bot) and the first preferred language.

  The user agent itself is not kept. Requests refused by the per-minute rate limit are
  recorded too.

- **Never at the visitor's expense:** a failed write is logged as a warning and the
  report is served anyway.
- **Retention:** a Firestore TTL policy deletes events 30 days after they happened.
- **Statistics:** `GET /api/admin/stats?days=7|30` reads at most 5,000 recent events
  and summarises them on the server: visitors, analyses, success rate, response times,
  cache hits, failures by reason with the latest ones, top repositories, devices,
  languages and the GitHub points left. The owner's own analyses are left out.
- **Access:** only a browser holding the owner cookie (ADR 0008) gets the statistics;
  anyone else gets 404, as if the route did not exist. The owner page shows them once
  signed in.
- Without a Firestore project, as in local development, events stay in memory.

## Alternatives considered

- **Reading Cloud Logging from the server.** No new storage, but the service account
  would need log read access, queries are slower, and request logs carry more than the
  statistics need.
- **Log-based metrics and a Cloud Monitoring dashboard.** Good for volumes and errors,
  but it shows no repository or failure detail and stays in the console, not on the
  site.
- **A client-side analytics service.** It would track visitors across pages, require
  a consent banner and load a third-party script, against the site's privacy stance.
- **Daily counters instead of events.** Cheaper to read, but they lose the detail of
  failures and fix the questions in advance.

## Consequences

- Each analysis adds one Firestore write, well within the free tier, and adds a few
  tens of milliseconds to the answer.
- A statistics view reads up to 5,000 documents; past that, the figures cover the most
  recent events and the page says so.
- The public documentation states what is recorded and for how long.
- The TTL policy is applied with Terraform by the maintainer.
- Extends ADR 0008.
