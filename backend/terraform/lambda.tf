locals {
  lambda_build_dir = "${path.module}/../.lambda-build"
}

resource "terraform_data" "lambda_package_prep" {
  triggers_replace = [
    filesha256("${path.module}/../requirements.txt"),
    filesha256("${path.module}/../lambda_handler.py"),
    filesha256("${path.module}/../src/app.py"),
    filesha256("${path.module}/../src/config.py"),
    filesha256("${path.module}/../src/handlers.py"),
    filesha256("${path.module}/../src/auth.py"),
    filesha256("${path.module}/../src/adapters/ai.py"),
    filesha256("${path.module}/../src/adapters/factory.py"),
    filesha256("${path.module}/../src/adapters/storage.py"),
    filesha256("${path.module}/../src/adapters/userstore.py"),
    filesha256("${path.module}/../src/adapters/vector.py"),
  ]

  provisioner "local-exec" {
    command = <<-EOT
      set -euo pipefail
      rm -rf "${local.lambda_build_dir}"
      mkdir -p "${local.lambda_build_dir}"
      cp -R "${path.module}/../src" "${local.lambda_build_dir}/src"
      cp "${path.module}/../lambda_handler.py" "${local.lambda_build_dir}/lambda_handler.py"
      pip install --no-cache-dir -r "${path.module}/../requirements.txt" --target "${local.lambda_build_dir}"
    EOT
  }
}

resource "aws_lambda_function" "backend" {
  function_name = "study-buddy-${var.group_id}-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  runtime       = "python3.12"
  handler       = "lambda_handler.handler"
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.lambda_package.output_path
  source_code_hash = data.archive_file.lambda_package.output_base64sha256

  environment {
    variables = {
      STORAGE_BACKEND       = "s3"
      STORAGE_BUCKET        = aws_s3_bucket.uploads.id
      USERSTORE_BACKEND     = "dynamodb"
      DOCUMENTS_TABLE       = aws_dynamodb_table.documents.name
      CHAT_MESSAGES_TABLE   = aws_dynamodb_table.chat_messages.name
      FLASHCARD_SETS_TABLE  = aws_dynamodb_table.flashcard_sets.name
      QUIZZES_TABLE         = aws_dynamodb_table.quizzes.name
      BATTLE_SESSIONS_TABLE = aws_dynamodb_table.battle_sessions.name
      AI_BACKEND            = "bedrock"
      AI_MODEL_ID           = var.bedrock_model_id
      VECTOR_BACKEND        = "bedrock_kb"
      VECTOR_BEDROCK_KB_ID  = aws_bedrockagent_knowledge_base.main.id
      AWS_REGION            = var.aws_region
      CORS_ORIGINS          = join(",", var.frontend_urls)
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.frontend.id
      COGNITO_DOMAIN        = aws_cognito_user_pool_domain.main.domain
    }
  }

  depends_on = [terraform_data.lambda_package_prep]
}

data "archive_file" "lambda_package" {
  type        = "zip"
  source_dir  = local.lambda_build_dir
  output_path = "${path.module}/../../lambda_payload.zip"

  depends_on = [terraform_data.lambda_package_prep]
}
