resource "google_artifact_registry_repository" "images" {
  repository_id = "devpulse"
  location      = var.region
  format        = "DOCKER"
  description   = "DevPulse server images, tagged with the commit SHA and the release version."

  # Stay under the 0.5 GB of free storage (ADR 0007). Keep policies win over delete
  # policies, so release images and the latest builds, among them the revision used
  # for a rollback, are never deleted.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "delete-after-two-weeks"
    action = "DELETE"
    condition {
      tag_state  = "ANY"
      older_than = "1209600s"
    }
  }

  cleanup_policies {
    id     = "keep-releases"
    action = "KEEP"
    condition {
      tag_state    = "TAGGED"
      tag_prefixes = ["v"]
    }
  }

  cleanup_policies {
    id     = "keep-latest-builds"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  depends_on = [google_project_service.apis]
}
