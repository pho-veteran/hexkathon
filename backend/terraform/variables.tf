variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "group_id" {
  description = "W7 group identifier for resource naming and tagging"
  type        = string
  default     = "g1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID for AI generation"
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}

variable "frontend_urls" {
  description = "Allowed frontend origins for CORS and Cognito"
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN for CloudFront custom domain (optional)"
  type        = string
  default     = ""
}

variable "cloudfront_domain_aliases" {
  description = "Custom domain aliases for CloudFront (optional)"
  type        = list(string)
  default     = []
}

variable "budget_notification_email" {
  description = "Email address for AWS budget notifications"
  type        = string
  default     = "team+g1@study-buddy.demo"
}
