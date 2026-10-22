# 0007. Deploy the dashboard publicly on Google Cloud Run

- Status: proposed
- Date: 2026-10-22

## Context

ADR 0006 made the dashboard local only. The `node:http` server in `src/server/main.ts`
binds `127.0.0.1`, rejects any `Host` other than `127.0.0.1` or `localhost` (DNS
rebinding defence), and mounts Vite in middleware mode. It stated that publishing
beyond a local machine needs a new record covering the build, hosting and token
protection. ADR 0004 proposed a local Docker Compose deployment only; hosting is
undecided in `docs/ARCHITECTURE.md`.

Issue #22 asks for the dashboard to be reachable online, continuously delivered, at
zero cost, with tooling widely used in industry, and resistant to anonymous visitors
and to the expected load.

The main risk is not CPU but the single shared GitHub token, which has 5,000 points
per hour. One uncached report on a typical repository costs about 3 to 5 points (the
default-branch query, the refs pages and the protected-branches REST pages), so about
1,000 uncached reports per hour exhaust it. An abusive client could deny service to
everyone.

The estimated load is a portfolio project with 10 to 100 visitors per day and peaks
around 500 visitors per hour after a public post. Visitors mostly try the same few
popular repositories.

## Decision

- **Production build:** `vite build` writes the interface to a build directory. In
  production the server serves those static files itself, without Vite at runtime, so
  there is still one process and one port. Development keeps `npm run web` with Vite
  middleware. TypeScript still runs natively on Node 24; the server has no transpile
  step.
- **Configuration:** the listen address, the port and the allowed `Host` values come
  from environment variables. The local defaults stay `127.0.0.1` and the current
  `Host` check. The deployed service listens on `0.0.0.0` with the allowed hosts set to
  its public URLs, so the DNS rebinding defence is generalised, not removed. Terraform
  computes those URLs from the deterministic form
  `<service>-<project-number>.<region>.run.app`, so no second apply is needed.
- **Quota protection, in the application:**
  1. An in-memory cache of repository data per repository, with a 10 minute TTL and a
     bounded number of entries (LRU).
  2. Per-client-IP rate limiting on the API. The client IP is the entry appended by
     Google's front end in `X-Forwarded-For`, not the first, client-controlled entry.
     This holds only while clients reach Cloud Run directly; a load balancer, CDN or
     WAF in front would make the last entry its own address, so adding one requires
     revisiting this rule. Excess requests get 429 with `Retry-After`.
  3. A quota guard that stops calling GitHub and answers 503 when the token's
     remaining quota falls below a reserve.
  4. A request timeout, so very large repositories cannot hold instances.

  Limits are per instance, so the effective limits are multiplied by the instance
  count. This is accepted and bounded by the maximum number of instances. There is no
  shared store.

- **Token:** a dedicated fine-grained personal access token with read-only access to
  public repositories, never the maintainer's personal CLI token. It is stored in
  Google Secret Manager and injected as `GITHUB_TOKEN` at runtime. It is never in the
  image, the repository or CI logs.
- **Hosting:** Google Cloud Run in `europe-west1`, one container serving the interface
  and the API. Minimum instances 0, maximum 3 (1 for staging), CPU allocated only
  during requests, 512 MiB of memory. This fits the Cloud Run free tier; a cold start
  takes about one second. A dedicated runtime service account holds only
  `secretAccessor` on that secret.
- **Container:** a multi-stage Dockerfile with a Node 24 slim base image pinned by
  digest, production dependencies only, a non-root user, and a health endpoint
  `GET /healthz`. A root `compose.yaml` runs the same image locally, which fulfils the
  local deployment proposed in ADR 0004.
- **Infrastructure as code:** Terraform in a new top-level `infra/` directory, which
  this record introduces. Provider versions are pinned. Remote state lives in a
  versioned Google Cloud Storage bucket in `us-central1`, where Cloud Storage has a
  free tier, created once by a documented bootstrap step.
  Terraform manages the Artifact Registry repository with a cleanup policy (to stay
  under the 0.5 GB free storage, SBOMs and attestations included) that always keeps
  release images and the last few commit images, so the revision used for rollback is
  never deleted, the Cloud Run services, service accounts and IAM, the
  Secret Manager secret (its value is set out of band and never enters Terraform
  state), Workload Identity Federation, an uptime check, alerting, and the cost
  protection below. CI checks that Terraform is formatted and valid; plan and apply
  run on the maintainer's machine, because a plan in CI would need a read identity
  for pull request branches, which the federation deliberately refuses.
- **Cost protection:** a monthly budget of 1 EUR that excludes credits, so free-trial
  credit cannot hide real usage, emails at 10%, 50% and 100%, and publishes to
  Pub/Sub. A budget alert never stops spending on its own, so a kill switch, a small
  Cloud Run function in `infra/kill-switch/` with no dependency, detaches the billing
  account from the project once the budget is reached. Its service account holds only
  `roles/billing.projectManager` on the project. The site then stops until billing is
  linked again by hand; billing data arrives with a delay of hours, so the worst case
  is a small overshoot of the budget, not unbounded cost.
- **CI authentication:** Workload Identity Federation with GitHub OIDC. No service
  account key is stored in GitHub. The provider accepts only workflows of this
  repository, identified by its numeric ID, running on `main` or on a `v*` release
  tag, so pull request branches cannot deploy. The deployer service account has only
  the roles needed to push images and deploy Cloud Run.
- **Delivery pipeline (GitHub Actions):**
  - On pull requests: the existing checks, plus an image build and a Trivy scan that
    fails on fixable HIGH or CRITICAL vulnerabilities.
  - On push to `main`: build once, tag with the commit SHA, push to Artifact Registry
    with an SBOM and a build provenance attestation, deploy to a `staging` Cloud Run
    service (scale to zero) and run a smoke test.
  - When release-please publishes a `vX.Y.Z` release: promote the same image digest,
    without rebuilding, to the `production` service through a GitHub Environment that
    requires the maintainer's approval. The new revision is deployed without traffic
    and health-checked through a revision tag, then receives all traffic; the public
    URL is smoke tested, and on failure traffic shifts back to the previous revision.
    Releases map one-to-one to production versions. release-please and the deployment
    jobs share one workflow, so that the image of a release commit is built and
    tested in staging before production can use it.
- **Load testing:** k6 scenarios run against staging from a manually triggered
  workflow. Thresholds: 50 requests per second for 2 minutes on cached repositories,
  p95 below 300 ms, no server errors; excess requests from one client get 429. k6 is a
  CI tool, not an npm dependency.
- **Observability:** structured JSON logs on stdout, which Cloud Logging parses, with
  one line per request giving status, duration and cache hit, and never a token. An
  uptime check on the production `/healthz` every 15 minutes with email alerting; each
  check may wake an instance, which is accepted, and staging has no check. An availability objective of 99% per
  month, documented as an SLO.
- **Out of scope:** a custom domain, a CDN or WAF (for example Cloudflare) in front of
  the service, user authentication or per-user tokens, and the CLI, which is not
  deployed.

## Alternatives considered

- **Do nothing.** The project stays local and cannot be shown.
- **Render free tier.** No card is needed, but cold starts after sleep take about 50 s,
  and there is less control: no IaC-first workflow and no keyless federation.
- **Fly.io.** As of October 2026, it has no free tier for new accounts.
- **Vercel, Netlify or Cloudflare Workers.** The `node:http` server would have to be
  rewritten into each platform's function model, coupling the code to the vendor.
- **Compute Engine e2-micro always-free VM.** Free, but the operating system, patching,
  TLS and restarts become our job, and there is no scale to zero or revision rollback.
- **Kubernetes (GKE or EKS).** Not free and oversized for one stateless container;
  reconsider with several services.
- **Static hosting (GitHub Pages) with the browser calling GitHub.** It either exposes
  a token or makes every visitor supply one.
- **A shared cache (Memorystore or Redis).** Not free; per-instance memory is enough at
  this load.
- **Per-visitor GitHub OAuth.** It spreads the quota across users but adds
  authentication and token storage; reconsider if the shared quota becomes the
  bottleneck.
- **Service account JSON key in GitHub secrets.** A long-lived credential that can
  leak; federation issues short-lived tokens.
- **Pulumi or plain `gcloud` scripts.** Terraform is the most widely used IaC tool, and
  its plan and apply review fits the pull request workflow.

## Consequences

- A public demo becomes reachable. Every release is traceable from commit to running
  revision, rollback is one traffic switch, and no long-lived cloud credential exists
  anywhere.
- Docker and Terraform become tooling of the project.
- A Google Cloud project with billing enabled is required. The free tier and the
  maximum instance counts keep the expected cost at zero; the kill switch bounds the
  unexpected cost near the budget, at the price of stopping the site.
- The cache and the limits live in memory, so they reset on cold starts and are per
  instance.
- Anonymous visitors share one quota, so heavy use degrades to 429 or 503 rather than
  to more spending.
- The first deployment needs a manual bootstrap (project, state bucket, secret value),
  documented in `docs/DEPLOYMENT.md`.
- The server gains state (cache and rate limiter), which falls under architectural
  review.
- This record supersedes the "Local deployment (proposed)" part of ADR 0004; its
  release automation part stays accepted. It extends ADR 0006: the local development
  mode and its `Host` check are unchanged by default.
- Implementation is split into separate pull requests: production server (build,
  configuration, cache, limits, health, logs), container, infrastructure, delivery
  pipeline, and load test with observability. Like ADR 0004, the record is merged as
  proposed so that those pull requests can refer to it, and becomes accepted when the
  service is deployed by the pipeline.
