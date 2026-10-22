output "service_urls" {
  description = "Public URLs of the Cloud Run services; the only ones the server answers."
  value       = { for key, host in local.hosts : key => "https://${host}" }
}

output "image_repository" {
  description = "Where the pipeline pushes images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "workload_identity_provider" {
  description = "Value of `workload_identity_provider` for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Value of `service_account` for google-github-actions/auth."
  value       = google_service_account.deployer.email
}
