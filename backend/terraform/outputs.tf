output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "cognito_hosted_ui_base_url" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "frontend_primary_url" {
  value = var.frontend_urls[length(var.frontend_urls) - 1]
}

output "frontend_redirect_uri" {
  value = var.frontend_urls[length(var.frontend_urls) - 1]
}

output "frontend_signout_uri" {
  value = var.frontend_urls[length(var.frontend_urls) - 1]
}

output "storage_bucket" {
  value = aws_s3_bucket.uploads.id
}

output "lambda_function_name" {
  value = aws_lambda_function.backend.function_name
}

output "documents_table" {
  value = aws_dynamodb_table.documents.name
}

output "projects_table" {
  value = aws_dynamodb_table.projects.name
}

output "chat_threads_table" {
  value = aws_dynamodb_table.chat_threads.name
}

output "chat_messages_table" {
  value = aws_dynamodb_table.chat_messages.name
}

output "flashcard_sets_table" {
  value = aws_dynamodb_table.flashcard_sets.name
}

output "quizzes_table" {
  value = aws_dynamodb_table.quizzes.name
}

output "battle_sessions_table" {
  value = aws_dynamodb_table.battle_sessions.name
}

output "bedrock_kb_id" {
  value = aws_bedrockagent_knowledge_base.main.id
}

output "bedrock_data_source_id" {
  value = aws_bedrockagent_data_source.uploads.data_source_id
}

output "cloudfront_domain_name" {
  value = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].domain_name : ""
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  value = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].id : ""
}
