locals {
  # Both services scale to zero; staging needs a single instance at most.
  services = {
    staging    = { name = "devpulse-staging", max_instances = 1 }
    production = { name = "devpulse", max_instances = 3 }
  }

  # The deterministic host of each service, known before the service exists (ADR 0007).
  # It is the only name the server answers to; the older *.a.run.app URL gets 403.
  hosts = {
    for key, service in local.services :
    key => "${service.name}-${data.google_project.this.number}.${var.region}.run.app"
  }

  # Cloud Run needs an image to create a service; the delivery pipeline replaces it.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_service_account" "runtime" {
  account_id   = "devpulse-runtime"
  display_name = "DevPulse server"
  description  = "Identity of the running server: reads its secrets and the visitor allowance."

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "app" {
  for_each = local.services

  name     = each.value.name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  # Production is public. Staging requires a Google identity (ADR 0008): it runs with
  # the production GitHub token, so it must not be another way to drain its quota.
  invoker_iam_disabled = each.key == "production"
  deletion_protection  = each.key == "production"

  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 80
    timeout                          = "60s"

    scaling {
      min_instance_count = 0
      max_instance_count = each.value.max_instances
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        # CPU is allocated and billed only while a request is being handled.
        cpu_idle          = true
        startup_cpu_boost = false
      }

      env {
        name  = "ALLOWED_HOSTS"
        value = local.hosts[each.key]
      }
      env {
        # Clients reach Cloud Run directly, whose front end appends their address.
        name  = "TRUST_PROXY"
        value = "true"
      }
      env {
        name = "GITHUB_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.github_token.secret_id
            version = "latest"
          }
        }
      }
      # Daily allowance and maintainer access (ADR 0008).
      env {
        name  = "QUOTA_PER_DAY"
        value = tostring(var.visitor_quota_per_day)
      }
      env {
        name  = "FIRESTORE_PROJECT"
        value = var.project_id
      }
      env {
        name = "VISITOR_SALT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.visitor["visitor_salt"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OWNER_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.visitor["owner_key"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    # Images and the traffic split are managed by the delivery pipeline, not by
    # Terraform: an apply must never undo a promotion or a rollback.
    ignore_changes = [template[0].containers[0].image, client, client_version, traffic]
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_iam_member.runtime_reads_token,
    google_secret_manager_secret_iam_member.runtime_reads_visitor_secrets,
    google_project_iam_member.runtime_uses_firestore,
    google_firestore_field.visitor_expiry,
  ]
}
