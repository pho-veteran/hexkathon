locals {
  lambda_build_dir  = "${path.module}/../.lambda-build"
  lambda_source_dir = "${path.module}/.."
}

resource "terraform_data" "lambda_package_prep" {
  triggers_replace = concat([
    filesha256("${local.lambda_source_dir}/requirements.lambda.txt"),
    filesha256("${local.lambda_source_dir}/lambda_handler.py"),
  ], [
    for file in sort(fileset(local.lambda_source_dir, "src/**/*.py")) : filesha256("${local.lambda_source_dir}/${file}")
  ])

  provisioner "local-exec" {
    interpreter = ["pwsh", "-NoLogo", "-NonInteractive", "-Command"]
    command     = <<-EOT
      $projectRoot = [System.IO.Path]::GetFullPath("${local.lambda_source_dir}")
      $buildDir = [System.IO.Path]::GetFullPath("${local.lambda_build_dir}")
      if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force -Confirm:$false }
      New-Item -ItemType Directory -Path $buildDir | Out-Null
      Copy-Item "$projectRoot/src" "$buildDir/src" -Recurse -Force
      Copy-Item "$projectRoot/lambda_handler.py" "$buildDir/lambda_handler.py" -Force
      python -m pip install --no-cache-dir --platform manylinux2014_x86_64 --python-version 3.12 --implementation cp --only-binary=:all: -r "$projectRoot/requirements.lambda.txt" --target "$buildDir"
      Get-ChildItem $buildDir -Recurse -Directory | Where-Object { $_.Name -in @('tests','__pycache__') } | Remove-Item -Recurse -Force -Confirm:$false
      Get-ChildItem $buildDir -Recurse -Filter *.pyc | Remove-Item -Force -Confirm:$false
      if (-not (Test-Path "$buildDir/lambda_handler.py")) { throw 'Missing lambda_handler.py' }
      if (-not (Test-Path "$buildDir/src/app.py")) { throw 'Missing src/app.py' }
      if (-not (Test-Path "$buildDir/boto3/__init__.py")) { throw 'Missing boto3 package' }
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
      PROJECTS_TABLE        = aws_dynamodb_table.projects.name
      CHAT_THREADS_TABLE    = aws_dynamodb_table.chat_threads.name
      CHAT_MESSAGES_TABLE   = aws_dynamodb_table.chat_messages.name
      FLASHCARD_SETS_TABLE  = aws_dynamodb_table.flashcard_sets.name
      QUIZZES_TABLE         = aws_dynamodb_table.quizzes.name
      BATTLE_SESSIONS_TABLE = aws_dynamodb_table.battle_sessions.name
      AI_BACKEND            = "bedrock"
      AI_MODEL_ID           = var.bedrock_model_id
      VECTOR_BACKEND             = "bedrock_kb"
      VECTOR_BEDROCK_KB_ID       = aws_bedrockagent_knowledge_base.main.id
      VECTOR_BEDROCK_DATA_SOURCE_ID = aws_bedrockagent_data_source.uploads.data_source_id
      CORS_ORIGINS               = join(",", var.frontend_urls)
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
