resource "random_string" "cognito_domain_suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "aws_cognito_user_pool" "main" {
  name = "study-buddy-${var.group_id}-${var.environment}"

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  schema {
    attribute_data_type      = "String"
    name                     = "email"
    required                 = true
    mutable                  = true
    developer_only_attribute = false
  }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "study-buddy-frontend-${var.group_id}"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.frontend_urls
  logout_urls                          = var.frontend_urls
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "study-buddy-${var.group_id}-${var.environment}-${random_string.cognito_domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user" "demo_trainer" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "trainer${var.group_id}@study-buddy.demo"

  attributes = {
    email          = "trainer${var.group_id}@study-buddy.demo"
    email_verified = true
  }

  temporary_password = "DemoPass123!"
}
