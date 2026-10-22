variable "project_id" {
  description = "Google Cloud project that hosts DevPulse."
  type        = string
  default     = "devpulse-brahim"
}

variable "region" {
  description = "Region of Cloud Run, Artifact Registry and the kill switch."
  type        = string
  default     = "europe-west1"
}

variable "billing_account" {
  description = "Billing account ID that the budget watches, such as 012345-6789AB-CDEF01."
  type        = string
}

variable "alert_email" {
  description = "Address that receives budget and uptime alerts."
  type        = string
}

variable "github_repository_id" {
  description = "Numeric ID of BrahimNJ/DevPulse, the only repository allowed to deploy; unlike a name, it cannot be taken over after a rename."
  type        = string
  default     = "1398562259"
}

variable "budget_amount_eur" {
  description = "Monthly budget in euros. Reaching it detaches billing from the project."
  type        = number
  default     = 1

  validation {
    # The budget API takes whole currency units here.
    condition     = var.budget_amount_eur >= 1 && floor(var.budget_amount_eur) == var.budget_amount_eur
    error_message = "The budget must be a whole number of euros, at least 1."
  }
}
