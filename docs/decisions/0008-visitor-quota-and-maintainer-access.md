# 0008. Limit analyses per visitor and give the maintainer unlimited access

- Status: proposed
- Date: 2026-10-22

## Context

ADR 0007 made the dashboard public on Cloud Run. All visitors share one GitHub token,
which has 5,000 points per hour. The in-memory cache and the per-instance rate limiter
of ADR 0007 reset whenever Cloud Run scales to zero and are not shared between
instances, so they cannot enforce a per-visitor allowance over a day.

Issue #38 asks for each visitor to be limited to three analyses (distinct repositories)
per 24 hours. Refreshing the page, clearing cookies or using a private window must not
reset the allowance. The maintainer keeps unlimited use online.

An audit also found that the staging service was public and used the production GitHub
token. That doubled the surface through which the shared quota could be drained.

## Decision

- **Allowance:** 3 distinct repositories per visitor per rolling window of 24 hours,
  configured by `QUOTA_PER_DAY`. It is unset locally, so development, `npm start` and
  the CLI are unlimited. Repeating an already analysed repository is free. A repository
  is reserved before calling GitHub and released if the repository does not exist, so a
  burst of parallel requests cannot exceed the allowance. Excess requests get 429 with
  the time the window resets; `GET /api/quota` reports the remaining allowance to the
  interface.
- **Visitor identity:** an HMAC-SHA256 of the client address (IPv6 truncated to its
  /64, since one subscriber holds a whole /64) with a secret salt (`VISITOR_SALT`). The
  raw address is never stored, and without the salt the hash cannot be reversed by
  enumerating addresses. Accepted trade-off: people behind one shared address (office,
  school, carrier NAT) share an allowance.
- **Store:** Cloud Firestore (Native mode, the `(default)` database, `europe-west1`),
  inside its free tier (50,000 reads and 20,000 writes per day; each analysis costs at
  most one read and one write). One document per visitor holds the repositories and the
  window start; a TTL policy on `expireAt` deletes expired documents. Updates use
  optimistic concurrency (`currentDocument.updateTime` preconditions, retried), so
  concurrent instances cannot both grant the last slot. It is accessed through the
  Firestore REST API with `fetch` and a token from the metadata server, so there is no
  npm dependency. The runtime service account gets `roles/datastore.user`. An in-memory
  store with the same interface serves tests and local runs.
- **Maintainer access:** a secret `OWNER_KEY` in Secret Manager. Submitting it once
  through `POST /api/owner` (a hidden `/owner` page) sets a cookie `devpulse_owner`
  holding an expiry and an HMAC of it keyed by the owner key: HttpOnly, Secure behind
  the proxy, SameSite=Strict, 30 days. The key comparison is constant-time, attempts
  are rate limited (5 per minute per client), the request Origin must be one of the
  allowed hosts, and rotating the key invalidates every cookie. `DELETE /api/owner`
  signs out. Owners bypass the daily allowance only; the per-minute rate limiter of
  ADR 0007 still applies to them.
- **Private staging:** the staging service requires a Google identity
  (`roles/run.invoker`) instead of being public. The smoke test of the delivery
  pipeline sends an identity token of the deployer service account. The maintainer
  checks staging with `curl` and `gcloud auth print-identity-token`; staging is not
  meant to be browsed.
- **Secrets:** `owner-key` and `visitor-salt` are created out of band like
  `github-token` (ADR 0007), adopted by Terraform with import blocks, and readable only
  by the runtime service account.

## Alternatives considered

- **Do nothing.** One visitor can use the shared GitHub quota alone, and the per-instance
  limits of ADR 0007 give no daily allowance.
- **Counting in a cookie or localStorage.** Clearing it or opening a private window
  resets the count.
- **In-memory counting.** It resets on every scale to zero and differs per instance.
- **Memorystore or Redis.** Not free.
- **Cloud SQL.** Not free and oversized for one small counter per visitor.
- **GitHub OAuth for visitors.** It forces recruiters to sign in and adds a client
  secret and token storage.
- **GitHub OAuth for the maintainer only.** It needs an OAuth app, a callback and a
  secret for a single user; a key is enough.
- **Storing raw IP addresses.** They are personal data and unnecessary; a salted hash
  is enough.
- **A fixed daily reset at midnight UTC.** It penalises visitors depending on their
  time zone; a rolling window is fairer.

## Consequences

- Firestore becomes a managed dependency of production, with a new API and a new IAM
  role.
- A request that needs a reservation takes one extra round trip to Firestore (about
  10 to 30 ms). A cached report of a repository already in the window costs no write.
- People behind a shared address share an allowance.
- An attacker rotating many addresses still gets 3 analyses per address. That is
  bounded by the per-minute limiter and by the GitHub quota reserve of ADR 0007.
- The maintainer must keep the owner key secret and can rotate it, which signs out
  every device.
- Local development stays unlimited and needs no cloud access.
- Staging is no longer viewable without a Google identity.
- This record extends ADR 0007, whose in-memory cache and rate limiter remain in place.
