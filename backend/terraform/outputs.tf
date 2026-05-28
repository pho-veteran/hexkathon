output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  value = aws_cognito_user_pool_domain.main.domain
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
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

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}
