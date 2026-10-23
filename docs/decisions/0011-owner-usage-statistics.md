# 0011. Record pseudonymous analysis events for the owner's statistics

- Status: accepted
- Date: 2026-10-23

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
  - the report (branches or delivery) and the repository, cut to 140 characters;
  - the salted visitor hash of ADR 0008, never the address;
  - whether the owner made it;
  - the status and an outcome derived from it;
  - the duration and whether the cache answered;
  - a coarse device class (mobile, desktop, bot) and the first preferred language.

  The data is pseudonymous, not anonymous: the hash links the analyses of one address
  for 30 days. The user agent itself is not kept. Requests refused by the per-minute
  rate limit are not recorded, so a flood cannot turn into writes.

- **Never at the visitor's expense:** recording waits at most one second, whatever
  hangs, and a failure is logged as a warning while the report is served anyway.
- **Retention:** a Firestore TTL policy deletes events 30 days after they happened.
- **Statistics:** `GET /api/admin/stats?days=7|30` reads at most 5,000 events from UTC
  midnight of the period's first day and summarises them on the server: visitors,
  analyses, success rate, response times, cache hits, distinct repositories, failures
  by reason with the latest ones, top repositories, devices, languages and the GitHub
  points left. The owner's own analyses are left out. Each view is reused for a minute.
- **Access:** only a browser holding the owner cookie (ADR 0008) gets the statistics;
  anyone else gets 404, as if the route did not exist. The owner page shows them once
  signed in.
- Without a Firestore project, as in local development, the newest 10,000 events stay
  in memory.

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

- Each analysis adds one Firestore write, within the free tier of 20,000 a day, and
  usually a few tens of milliseconds to the answer.
- A statistics view reads up to 5,000 documents, against a free tier of 50,000 reads a
  day; the one-minute reuse keeps refreshes cheap. Past 5,000 events, the figures
  cover the most recent ones and the page says so.
- The public documentation states what is recorded and for how long.
- The TTL policy is applied with Terraform by the maintainer.
- Extends ADR 0008.
