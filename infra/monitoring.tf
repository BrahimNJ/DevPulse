resource "google_monitoring_notification_channel" "email" {
  display_name = "DevPulse maintainer"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

# Every 15 minutes on production only: each check may wake an instance (ADR 0007).
resource "google_monitoring_uptime_check_config" "production" {
  display_name = "DevPulse production health"
  timeout      = "10s"
  period       = "900s"

  http_check {
    path         = "/healthz"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = local.hosts.production
    }
  }

  # Three regions is the minimum, and keeps the number of checks low.
  selected_regions = ["EUROPE", "USA_VIRGINIA", "ASIA_PACIFIC"]

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_alert_policy" "production_down" {
  display_name = "DevPulse production is down"
  combiner     = "OR"

  conditions {
    display_name = "Health check failing"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.production.uptime_check_id}\" AND resource.type=\"uptime_url\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "900s"

      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]

  depends_on = [google_project_service.apis]
}
