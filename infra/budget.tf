# Cost protection (ADR 0007). A budget alert only warns, so the budget also publishes
# to Pub/Sub, where a function detaches billing from the project once the budget is
# reached. Credits are excluded, so free-trial credit cannot hide real usage.

resource "google_pubsub_topic" "budget" {
  name = "budget-alerts"

  depends_on = [google_project_service.apis]
}

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "DevPulse monthly budget"

  budget_filter {
    projects               = ["projects/${data.google_project.this.number}"]
    calendar_period        = "MONTH"
    credit_types_treatment = "EXCLUDE_ALL_CREDITS"
  }

  amount {
    specified_amount {
      currency_code = "EUR"
      units         = tostring(var.budget_amount_eur)
    }
  }

  # Emails at 10%, 50% and 100% of the budget.
  threshold_rules {
    threshold_percent = 0.1
  }
  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    pubsub_topic                     = google_pubsub_topic.budget.id
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
  }

  depends_on = [google_project_service.apis]
}

# --- Kill switch -------------------------------------------------------------------

resource "google_service_account" "kill_switch" {
  account_id   = "devpulse-kill-switch"
  display_name = "DevPulse budget kill switch"
  description  = "Can only detach billing from this project, and receive budget events."

  depends_on = [google_project_service.apis]
}

# Its only permissions are to link and unlink billing (create and delete billing
# assignments on the project), which is all the function does.
resource "google_project_iam_member" "kill_switch_billing" {
  project = var.project_id
  role    = "roles/billing.projectManager"
  member  = google_service_account.kill_switch.member
}

resource "google_project_iam_member" "kill_switch_receives_events" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = google_service_account.kill_switch.member
}

resource "google_service_account" "builder" {
  account_id   = "devpulse-function-builder"
  display_name = "DevPulse function builder"
  description  = "Builds the kill switch function with Cloud Build."

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "builder" {
  for_each = toset([
    "roles/cloudbuild.builds.builder",
    "roles/logging.logWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = google_service_account.builder.member
}

# Function sources live in us-central1, where Cloud Storage is free.
resource "google_storage_bucket" "functions" {
  name                        = "${var.project_id}-functions"
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

data "archive_file" "kill_switch" {
  type        = "zip"
  source_dir  = "${path.module}/kill-switch"
  output_path = "${path.module}/.build/kill-switch.zip"
  excludes    = ["index.test.mjs"]
}

resource "google_storage_bucket_object" "kill_switch" {
  # A new name for each version of the code makes Terraform redeploy the function.
  name   = "kill-switch-${data.archive_file.kill_switch.output_md5}.zip"
  bucket = google_storage_bucket.functions.name
  source = data.archive_file.kill_switch.output_path
}

resource "google_cloudfunctions2_function" "kill_switch" {
  name     = "budget-kill-switch"
  location = var.region

  build_config {
    runtime         = "nodejs22"
    entry_point     = "stopBilling"
    service_account = google_service_account.builder.id
    source {
      storage_source {
        bucket = google_storage_bucket.functions.name
        object = google_storage_bucket_object.kill_switch.name
      }
    }
  }

  service_config {
    max_instance_count    = 1
    available_memory      = "128Mi"
    timeout_seconds       = 60
    ingress_settings      = "ALLOW_INTERNAL_ONLY"
    service_account_email = google_service_account.kill_switch.email
    environment_variables = {
      PROJECT_ID = var.project_id
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.budget.id
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.kill_switch.email
  }

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.builder,
    google_project_iam_member.kill_switch_receives_events,
  ]
}

# Eventarc calls the function as the kill switch account.
resource "google_cloud_run_v2_service_iam_member" "kill_switch_invokes" {
  location = google_cloudfunctions2_function.kill_switch.location
  name     = google_cloudfunctions2_function.kill_switch.name
  role     = "roles/run.invoker"
  member   = google_service_account.kill_switch.member
}
