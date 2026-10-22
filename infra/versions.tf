# Infrastructure of the public deployment (ADR 0007). See docs/DEPLOYMENT.md for the
# bootstrap and apply procedure.

terraform {
  required_version = ">= 1.9, < 2.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.8"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # Created once by the bootstrap step, in us-central1 where Cloud Storage is free.
  # Versioning keeps every previous state, so a bad apply can be recovered.
  backend "gcs" {
    bucket = "devpulse-brahim-tfstate"
    prefix = "infra"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # The budget API, among others, needs a quota project when called with user
  # credentials; the project itself plays that role.
  user_project_override = true
  billing_project       = var.project_id
}

data "google_project" "this" {
  project_id = var.project_id
}
