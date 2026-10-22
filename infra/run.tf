locals {
  # Both services scale to zero; staging needs a single instance at most.
  services = {
    staging    = { name = "devpulse-staging", max_instances = 1 }
    production = { name = "devpulse", max_instances = 3 }
  }

  # Cloud Run needs an image to create a service; the delivery pipeline replaces it.
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_service_account" "runtime" {
  account_id   = "devpulse-runtime"
  display_name = "DevPulse server"
  description  = "Identity of the running server; it can only read the GitHub token."
}

resource "google_cloud_run_v2_service" "app" {
  for_each = local.services

  name     = each.value.name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  # Public site: anyone may call it without a Google identity.
  invoker_iam_disabled = true
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
        # The deterministic URL is known before the service exists (ADR 0007).
        name  = "ALLOWED_HOSTS"
        value = "${each.value.name}-${data.google_project.this.number}.${var.region}.run.app"
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
    }
  }

  lifecycle {
    # Images are deployed by the pipeline, not by Terraform.
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }

  depends_on = [google_secret_manager_secret_iam_member.runtime_reads_token]
}
