# Deployment

DevPulse runs on Google Cloud Run in the `devpulse-brahim` project, described as code
with Terraform in [`infra/`](../infra/). The decision, its alternatives and its limits
are in [ADR 0007](decisions/0007-public-deployment-on-cloud-run.md). This document is
the procedure.

## What Terraform manages

| File                | Resources                                                             |
| ------------------- | --------------------------------------------------------------------- |
| `apis.tf`           | The Google APIs the project uses                                      |
| `registry.tf`       | Artifact Registry repository `devpulse`, with a cleanup policy        |
| `run.tf`            | Cloud Run services `devpulse-staging` and `devpulse`, runtime account |
| `secret_manager.tf` | The `github-token` secret (not its value) and who may read it         |
| `github.tf`         | Workload Identity Federation for this repository, deployer account    |
| `monitoring.tf`     | Email channel, production uptime check every 15 minutes, alert policy |
| `budget.tf`         | Monthly budget of 1 EUR without credits, and the billing kill switch  |

Terraform creates the services with a placeholder image; the delivery pipeline deploys
DevPulse itself and Terraform ignores image changes afterwards.

## Cost

The design targets 0 EUR (ADR 0007):

- Cloud Run scales to zero, with at most 3 production instances and 1 staging instance,
  CPU billed only during requests, inside the monthly free tier.
- Cloud Storage buckets (Terraform state, function sources) are in `us-central1`, the
  only regions where Cloud Storage is free; the application stays in `europe-west1`.
- Artifact Registry deletes images older than two weeks, except release images and the
  ten latest builds, to stay under 0.5 GB.
- The budget ignores credits, so free-trial credit cannot hide real usage. It emails at
  0.10, 0.50 and 1 EUR.
- At 1 EUR the kill switch detaches billing from the project, which stops everything.
  Billing data can lag by hours, so the cost is bounded near the budget, not to the
  cent.

## First deployment

Run these commands in PowerShell from the repository root, with `gcloud` and
`terraform` installed. Steps 1 to 3 run once in the life of the project.

### 1. Point the tools at the project

```powershell
gcloud config set project devpulse-brahim
gcloud auth application-default set-quota-project devpulse-brahim
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com secretmanager.googleapis.com storage.googleapis.com
```

### 2. Create the Terraform state bucket

Terraform cannot create the bucket that stores its own state.

```powershell
gcloud storage buckets create gs://devpulse-brahim-tfstate --location=us-central1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://devpulse-brahim-tfstate --versioning
```

### 3. Store the GitHub token

Use the dedicated fine-grained token (public repositories, read-only, no permission),
never a personal one. The commands read it without echoing it and without a trailing
newline, which would make every GitHub call fail.

```powershell
gcloud secrets create github-token --replication-policy=automatic
$secure = Read-Host "GitHub token" -AsSecureString
$token = [Net.NetworkCredential]::new("", $secure).Password
$file = New-TemporaryFile
try {
  [IO.File]::WriteAllText($file, $token)
  gcloud secrets versions add github-token --data-file=$file
} finally {
  # The plaintext file is removed even if gcloud fails.
  Remove-Item $file -ErrorAction SilentlyContinue
  Remove-Variable token, secure
}
```

Terraform adopts this secret through the `import` block in `secret_manager.tf`; the token
value never enters the Terraform state.

### 4. Configure and apply

```powershell
cd infra
Copy-Item terraform.tfvars.example terraform.tfvars   # then edit both values
terraform init
terraform plan -out=tfplan
```

Read the plan before applying: it should only **create** resources, plus one
**import** for the secret, and never destroy one. Then:

```powershell
terraform apply tfplan
terraform output
```

The first apply takes several minutes, mostly for the kill switch function. Then open
the `staging` URL from `terraform output service_urls`: until the pipeline deploys
DevPulse, it shows the Cloud Run placeholder page. Share only these
`<service>-<project number>.europe-west1.run.app` URLs: they are the names in
`ALLOWED_HOSTS`, so the older `*.a.run.app` URL of the same service answers 403 once
DevPulse runs.

On a new project, an API or a service account can take a minute to become usable after
Terraform creates it, so the first apply may fail with a `403`, `SERVICE_DISABLED` or
"service account does not exist" error. Wait a minute and run `terraform plan
-out=tfplan` and `terraform apply tfplan` again: Terraform resumes where it stopped.

### 5. Check the kill switch without triggering it

Publish a fake budget notification below the budget; the function must log that it
received it and do nothing else:

```powershell
$message = '{"costAmount": 0.01, "budgetAmount": 1}'
gcloud pubsub topics publish budget-alerts --message=$message
gcloud functions logs read budget-kill-switch --region=europe-west1 --limit=10
```

Within a minute, the logs show `Budget cost 0.01 of 1: no action.` This proves the
whole chain: topic, trigger, permissions and code. Never publish a cost at or above
the budget: that would detach billing and stop the site.

## Continuous delivery

Once the infrastructure exists, `.github/workflows/delivery.yml` deploys DevPulse; no
command is run by hand.

```text
push to main ─► release-please
             └► build and push (image tagged <sha>, SBOM, provenance)
                 └► deploy to staging ─► smoke test
                     └► (release commit only) approval ─► production
```

1. **Every merge to `main`** builds the image once, pushes it to Artifact Registry,
   records a signed provenance attestation and a signed SBOM (generated by Trivy) on
   GitHub, deploys that digest to `devpulse-staging`, and smoke tests the health
   check, the interface and a real report. Staging deployments run one at a time; a
   release waiting for approval does not hold them back.
2. **Merging the release pull request** of release-please creates the `vX.Y.Z` release.
   The same run then waits in the `production` environment for your approval:
   **Actions → the run → Review deployments → Approve**. It then tags the digest with
   the version, deploys it without traffic, checks it, moves all traffic to it, and
   smoke tests the public URL. If that last check fails, or the job is cancelled
   during the switch, traffic returns to the previous revision automatically.

Terraform ignores the image and the traffic split of the services, so an apply never
undoes a deployment, a promotion or a rollback.

To check where an image comes from, after `gcloud auth configure-docker
europe-west1-docker.pkg.dev` so that `gh` can read the registry:

```sh
gh attestation verify oci://europe-west1-docker.pkg.dev/devpulse-brahim/devpulse/devpulse:<tag> --repo BrahimNJ/DevPulse
```

To roll back by hand, send traffic to an earlier revision listed in the Cloud Run
console:

```powershell
gcloud run services update-traffic devpulse --region=europe-west1 --to-revisions=<revision>=100
```

## Rotating the GitHub token

Repeat the token commands of step 3 from `$secure = ...` onwards, then disable the old
version in the Secret Manager console. New instances read the `latest` version.

## When the kill switch has fired

The site is down and the alert emails explain why. Find the cause in the billing
reports first, then link billing again:

```powershell
gcloud billing projects link devpulse-brahim --billing-account=<BILLING_ACCOUNT_ID>
```

## Removing everything

`terraform destroy` removes the resources except the protected secret and the
production service (`deletion_protection`); deleting the `devpulse-brahim` project in
the console removes everything at once.
