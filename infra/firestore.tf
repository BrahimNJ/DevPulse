# Store of the daily visitor allowance (ADR 0008). The (default) database is the one
# covered by the Firestore free tier.

resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  # Removing the database from Terraform leaves the data in place.
  deletion_policy = "ABANDON"

  depends_on = [google_project_service.apis]
}

# Deletes a visitor record once its 24-hour window has ended, so the collection never
# grows and no personal-data retention policy is needed beyond a day.
resource "google_firestore_field" "visitor_expiry" {
  database   = google_firestore_database.default.name
  collection = "visitors"
  field      = "expireAt"

  ttl_config {}
}

resource "google_project_iam_member" "runtime_uses_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = google_service_account.runtime.member
}

# Deletes an analysis event 30 days after it happened (ADR 0011): the owner's statistics
# never hold more than a month of anonymous usage.
resource "google_firestore_field" "event_expiry" {
  database   = google_firestore_database.default.name
  collection = "events"
  field      = "expireAt"

  ttl_config {}
}
