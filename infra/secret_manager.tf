# The GitHub token is created and given its value by the bootstrap step, outside
# Terraform, so that the value never enters the Terraform state. Terraform adopts the
# secret through this import and manages its access policy.
import {
  to = google_secret_manager_secret.github_token
  id = "projects/${var.project_id}/secrets/github-token"
}

resource "google_secret_manager_secret" "github_token" {
  secret_id = "github-token"

  replication {
    auto {}
  }

  lifecycle {
    # Replacing the secret would delete the token it holds.
    prevent_destroy = true
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_token" {
  secret_id = google_secret_manager_secret.github_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.runtime.member
}

# The maintainer's key and the salt of visitor identifiers (ADR 0008), created with
# their values by the bootstrap step and adopted here in the same way.
locals {
  visitor_secrets = {
    owner_key    = "owner-key"
    visitor_salt = "visitor-salt"
  }
}

import {
  for_each = local.visitor_secrets
  to       = google_secret_manager_secret.visitor[each.key]
  id       = "projects/${var.project_id}/secrets/${each.value}"
}

resource "google_secret_manager_secret" "visitor" {
  for_each = local.visitor_secrets

  secret_id = each.value

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "runtime_reads_visitor_secrets" {
  for_each = google_secret_manager_secret.visitor

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.runtime.member
}
