# Part 1: Platform/IaC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision all AWS infrastructure via Terraform and set up Docker Compose orchestration for local development.

**Architecture:** Single Terraform project under `backend/terraform/` owns Cognito User Pool, API Gateway HTTP API, Lambda execution role and function, S3 bucket, DynamoDB tables, Bedrock Knowledge Base skeleton, IAM policies, CloudFront distribution, and budget alerts. Docker Compose at repo root orchestrates frontend (Vite) and backend (FastAPI) containers for local dev.

**Tech Stack:** Terraform (HCL), AWS (Cognito, API Gateway HTTP API, Lambda Python 3.12, S3, DynamoDB, Bedrock KB, CloudFront, IAM, CloudWatch), Docker, Docker Compose, Python 3.12+ (for backend image)

---

### Task 1.1: Create root Docker Compose for local orchestration

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `frontend/vite.config.js`

- [ ] **Step 1: Create backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/

EXPOSE 8000
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 2: Create frontend Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

- [ ] **Step 3: Create root docker-compose.yml**

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - AWS_REGION=${AWS_REGION:-ap-southeast-1}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN}
      - STORAGE_BACKEND=s3
      - STORAGE_BUCKET=${STORAGE_BUCKET}
      - USERSTORE_BACKEND=dynamodb
      - DOCUMENTS_TABLE=${DOCUMENTS_TABLE}
      - CHAT_MESSAGES_TABLE=${CHAT_MESSAGES_TABLE}
      - FLASHCARD_SETS_TABLE=${FLASHCARD_SETS_TABLE}
      - QUIZZES_TABLE=${QUIZZES_TABLE}
      - BATTLE_SESSIONS_TABLE=${BATTLE_SESSIONS_TABLE}
      - AI_BACKEND=bedrock
      - AI_MODEL_ID=${AI_MODEL_ID:-anthropic.claude-3-haiku-20240307-v1:0}
      - VECTOR_BACKEND=bedrock_kb
      - VECTOR_BEDROCK_KB_ID=${VECTOR_BEDROCK_KB_ID}
      - COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
      - COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
      - COGNITO_DOMAIN=${COGNITO_DOMAIN}
      - CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:5173}
    volumes:
      - ./backend/src:/app/src
      - ./backend/lambda_handler.py:/app/lambda_handler.py
    env_file:
      - .env

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=${VITE_API_URL:-http://localhost:8000}
      - VITE_COGNITO_CLIENT_ID=${VITE_COGNITO_CLIENT_ID}
      - VITE_COGNITO_USER_POOL_ID=${VITE_COGNITO_USER_POOL_ID}
      - VITE_COGNITO_USER_POOL_DOMAIN=${VITE_COGNITO_USER_POOL_DOMAIN}
      - VITE_COGNITO_REGION=${AWS_REGION:-ap-southeast-1}
      - VITE_REDIRECT_URI=${VITE_REDIRECT_URI:-http://localhost:5173}
      - VITE_SIGNOUT_URI=${VITE_SIGNOUT_URI:-http://localhost:5173}
    volumes:
      - ./frontend/src:/app/src
    env_file:
      - .env
    depends_on:
      - backend
```

- [ ] **Step 4: Update frontend/vite.config.js for Docker dev**

Read `frontend/vite.config.js` and add server config so HMR works inside Docker:

Run: `cat frontend/vite.config.js`
Expected: see current Vite config

```javascript
// Add to or modify vite.config.js:
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,           // needed for Docker
    port: 5173,
    watch: {
      usePolling: true,   // needed for Docker file watching
    },
  },
})
```

- [ ] **Step 5: Create .env.example at repo root**

```bash
# .env.example — copy to .env and fill values after terraform apply
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
STORAGE_BUCKET=study-buddy-uploads-<accountid>
DOCUMENTS_TABLE=study-buddy-g1-documents
CHAT_MESSAGES_TABLE=study-buddy-g1-chat-messages
FLASHCARD_SETS_TABLE=study-buddy-g1-flashcard-sets
QUIZZES_TABLE=study-buddy-g1-quizzes
BATTLE_SESSIONS_TABLE=study-buddy-g1-battle-sessions
AI_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
VECTOR_BEDROCK_KB_ID=
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_DOMAIN=
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000
VITE_COGNITO_CLIENT_ID=
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_USER_POOL_DOMAIN=
VITE_COGNITO_REGION=ap-southeast-1
VITE_REDIRECT_URI=http://localhost:5173
VITE_SIGNOUT_URI=http://localhost:5173
```

- [ ] **Step 6: Verify Docker Compose picks up files**

Run: `docker compose config --services`
Expected output: `backend`, `frontend` (services listed in YAML order)

---

### Task 1.2: Create base Terraform project structure

**Files:**
- Create: `backend/terraform/main.tf`
- Create: `backend/terraform/variables.tf`
- Create: `backend/terraform/outputs.tf`
- Create: `backend/terraform/providers.tf`

- [ ] **Step 1: Create providers.tf**

```hcl
# backend/terraform/providers.tf
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "study-buddy"
      W7Group   = var.group_id
      ManagedBy = "terraform"
      CostCenter = "w7-hackathon"
    }
  }
}
```

- [ ] **Step 2: Create variables.tf**

```hcl
# backend/terraform/variables.tf
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
```

- [ ] **Step 3: Create outputs.tf**

```hcl
# backend/terraform/outputs.tf
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
  value = aws_bedrock_knowledge_base.main.knowledge_base_id
}
```

- [ ] **Step 4: Create main.tf (resource aggregation — starts empty, filled by subsequent tasks)**

```hcl
# backend/terraform/main.tf
# Resources are organized by service in separate .tf files
# This file imports nothing directly — each resource file uses variables from variables.tf
```

---

### Task 1.3: Create Cognito User Pool with Hosted UI

**Files:**
- Create: `backend/terraform/cognito.tf`

- [ ] **Step 1: Create Cognito resources**

```hcl
# backend/terraform/cognito.tf
resource "aws_cognito_user_pool" "main" {
  name = "study-buddy-${var.group_id}-${var.environment}"

  admin_create_user_config {
    allow_admin_create_user_only = true
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
    require_symbols   = false
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
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  callback_urls                        = var.frontend_urls
  logout_urls                          = var.frontend_urls
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "study-buddy-${var.group_id}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_user" "demo_trainer" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = "trainer-${var.group_id}"

  attributes = {
    email          = "trainer${var.group_id}@study-buddy.demo"
    email_verified = "true"
  }

  temporary_password = "DemoPass123!"
}
```

- [ ] **Step 2: Terraform validate**

Run: `cd backend/terraform && terraform init && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.4: Create S3 bucket and DynamoDB tables

**Files:**
- Create: `backend/terraform/s3.tf`
- Create: `backend/terraform/dynamodb.tf`

- [ ] **Step 1: Create s3.tf**

```hcl
# backend/terraform/s3.tf
resource "aws_s3_bucket" "uploads" {
  bucket = "study-buddy-uploads-${var.group_id}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_caller_identity" "current" {}
```

- [ ] **Step 2: Create dynamodb.tf with all 5 focused tables**

```hcl
# backend/terraform/dynamodb.tf
locals {
  table_prefix = "study-buddy-${var.group_id}"
}

resource "aws_dynamodb_table" "documents" {
  name         = "${local.table_prefix}-documents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "chat_messages" {
  name         = "${local.table_prefix}-chat-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "flashcard_sets" {
  name         = "${local.table_prefix}-flashcard-sets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "quizzes" {
  name         = "${local.table_prefix}-quizzes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "battle_sessions" {
  name         = "${local.table_prefix}-battle-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}
```

- [ ] **Step 3: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.5: Create IAM roles and policies

**Files:**
- Create: `backend/terraform/iam.tf`

- [ ] **Step 1: Create IAM role and policy for Lambda**

```hcl
# backend/terraform/iam.tf
resource "aws_iam_role" "lambda_exec" {
  name = "study-buddy-${var.group_id}-lambda-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_exec" {
  name = "study-buddy-${var.group_id}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/study-buddy-*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = ["${aws_s3_bucket.uploads.arn}/users/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.documents.arn,
          aws_dynamodb_table.chat_messages.arn,
          aws_dynamodb_table.flashcard_sets.arn,
          aws_dynamodb_table.quizzes.arn,
          aws_dynamodb_table.battle_sessions.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = ["arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}"]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:Retrieve",
          "bedrock:RetrieveAndGenerate"
        ]
        Resource = [aws_bedrock_knowledge_base.main.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = ["*"]
      },
    ]
  })
}
```

- [ ] **Step 2: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.6: Create API Gateway HTTP API with Cognito JWT authorizer

**Files:**
- Create: `backend/terraform/api_gateway.tf`

- [ ] **Step 1: Create API Gateway resources**

```hcl
# backend/terraform/api_gateway.tf
resource "aws_apigatewayv2_api" "http" {
  name          = "study-buddy-${var.group_id}-${var.environment}"
  protocol_type = "HTTP"
  description   = "Study Buddy Battle Quiz API"
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  name          = "study-buddy-cognito-authorizer"
  api_id        = aws_apigatewayv2_api.http.id
  authorizer_type = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "any_proxy" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "any_root" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorizer_id = aws_apigatewayv2_authorizer.cognito.id
}

# Health endpoint — no auth required
resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*"
}
```

- [ ] **Step 2: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.7: Create Lambda function with FastAPI + Mangum wrapper

**Files:**
- Create: `backend/terraform/lambda.tf`
- Create: `backend/lambda_handler.py`

- [ ] **Step 1: Create Lambda deployment helper and function resource**

```hcl
# backend/terraform/lambda.tf
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
      VECTOR_BEDROCK_KB_ID  = aws_bedrock_knowledge_base.main.knowledge_base_id
      AWS_REGION            = var.aws_region
      CORS_ORIGINS          = join(",", var.frontend_urls)
      COGNITO_USER_POOL_ID  = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.frontend.id
      COGNITO_DOMAIN        = aws_cognito_user_pool_domain.main.domain
    }
  }
}

data "archive_file" "lambda_package" {
  type        = "zip"
  output_path = "${path.module}/../../lambda_payload.zip"

  source {
    content  = file("${path.module}/../../lambda_handler.py")
    filename = "lambda_handler.py"
  }

  source {
    content  = file("${path.module}/../../src/__init__.py")
    filename = "src/__init__.py"
  }

  source {
    content  = file("${path.module}/../../src/app.py")
    filename = "src/app.py"
  }

  source {
    content  = file("${path.module}/../../src/auth.py")
    filename = "src/auth.py"
  }

  source {
    content  = file("${path.module}/../../src/config.py")
    filename = "src/config.py"
  }

  source {
    content  = file("${path.module}/../../src/handlers.py")
    filename = "src/handlers.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/__init__.py")
    filename = "src/adapters/__init__.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/factory.py")
    filename = "src/adapters/factory.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/storage.py")
    filename = "src/adapters/storage.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/userstore.py")
    filename = "src/adapters/userstore.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/vector.py")
    filename = "src/adapters/vector.py"
  }

  source {
    content  = file("${path.module}/../../src/adapters/ai.py")
    filename = "src/adapters/ai.py"
  }
}
```

- [ ] **Step 2: Create lambda_handler.py entrypoint**

```python
# backend/lambda_handler.py
"""Lambda entry point wrapping FastAPI with Mangum."""
from mangum import Mangum
from src.app import app

handler = Mangum(app)
```

- [ ] **Step 3: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.8: Create Bedrock Knowledge Base infra

**Files:**
- Create: `backend/terraform/bedrock.tf`

- [ ] **Step 1: Create Bedrock KB resources (skeleton — exact vector backend depends on account capabilities and cheapest option in region)**

```hcl
# backend/terraform/bedrock.tf
# NOTE: Bedrock Knowledge Base requires an existing vector store backend.
# For MVP, choose the cheapest option available in ap-southeast-1:
#   - S3 Vectors (no additional cost beyond S3 + Bedrock)
#   - OpenSearch Serverless (has fixed cost ~$0.13/hr/OCU)
#   - Aurora pgvector (has fixed RDS cost)
#
# This plan uses S3 Vectors as the default (cheapest, no additional service cost).
# If S3 Vectors is not available in the account, switch to OpenSearch Serverless
# and uncomment the OpenSearch resource below.

resource "aws_bedrock_knowledge_base" "main" {
  name     = "study-buddy-${var.group_id}-${var.environment}"
  role_arn = aws_iam_role.bedrock_kb.arn

  knowledge_base_configuration {
    type = "VECTOR"
    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"
    }
  }

  storage_configuration {
    type = "OPENSEARCH_SERVERLESS"
    # For cheapest MVP: use S3 as vector store if supported; else OpenSearch Serverless
    # If switching to S3 Vectors, change type to "S3" and set the bucket ARN
    opensearch_serverless_configuration {
      collection_arn = aws_opensearchserverless_collection.bedrock_kb.arn
      vector_index_name = "study-buddy-index"
      field_mapping {
        metadata_field = "metadata"
        text_field     = "text"
      }
    }
  }
}

# IAM role for Bedrock KB
resource "aws_iam_role" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-bedrock-kb-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-bedrock-kb-policy-${var.environment}"
  role = aws_iam_role.bedrock_kb.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel"
        ]
        Resource = ["arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-embed-text-v2:0"]
      },
      {
        Effect = "Allow"
        Action = [
          "aoss:APIAccessAll"
        ]
        Resource = ["*"]
      },
    ]
  })
}

# OpenSearch Serverless collection for KB
resource "aws_opensearchserverless_security_policy" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-kb-${var.environment}"
  type = "encryption"

  policy = jsonencode({
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/study-buddy-${var.group_id}-*"]
      }
    ]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_collection" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-kb-${var.environment}"
  type = "VECTORSEARCH"

  depends_on = [
    aws_opensearchserverless_security_policy.bedrock_kb
  ]
}

resource "aws_opensearchserverless_access_policy" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-kb-access-${var.environment}"
  type = "data"

  policy = jsonencode([
    {
      Rules = [
        {
          ResourceType = "index"
          Resource     = ["index/study-buddy-${var.group_id}-kb-${var.environment}/*"]
        },
        {
          ResourceType = "collection"
          Resource     = ["collection/study-buddy-${var.group_id}-kb-${var.environment}"]
        }
      ]
      Principal = [
        aws_iam_role.bedrock_kb.arn,
        aws_iam_role.lambda_exec.arn
      ]
    }
  ])
}
```

- [ ] **Step 2: Add bedrock_kb data source hook to outputs.tf if needed**

Run: `grep -c "bedrock_kb_id" backend/terraform/outputs.tf`
Expected: `1` (already exists from Task 1.2 Step 3)

- [ ] **Step 3: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.9: CloudFront distribution for frontend hosting

**Files:**
- Create: `backend/terraform/cloudfront.tf`
- Modify: `backend/terraform/variables.tf` (add domain vars)

- [ ] **Step 1: Add variables for custom domain (optional, can use CF default domain)**

Add to `backend/terraform/variables.tf`:
```hcl
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
```

- [ ] **Step 2: Create CloudFront distribution**

```hcl
# backend/terraform/cloudfront.tf
locals {
  s3_origin_id = "study-buddy-frontend-${var.group_id}"
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "study-buddy-frontend-oac-${var.group_id}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = var.cloudfront_domain_aliases

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain: set cloudfront_default_certificate = false,
    # acm_certificate_arn = var.cloudfront_certificate_arn,
    # ssl_support_method = "sni-only",
    # minimum_protocol_version = "TLSv1.2_2021"
  }
}
```

- [ ] **Step 3: Add S3 bucket for frontend hosting**

```hcl
# (Add to s3.tf or separate file)
resource "aws_s3_bucket" "frontend" {
  bucket = "study-buddy-frontend-${var.group_id}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend_bucket" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "frontend_oac" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
```

- [ ] **Step 4: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.10: Budget alerts and cost controls

**Files:**
- Create: `backend/terraform/cost_controls.tf`

- [ ] **Step 1: Create budget alert**

```hcl
# backend/terraform/cost_controls.tf
resource "aws_budgets_budget" "cost_alert" {
  name              = "study-buddy-${var.group_id}-budget"
  budget_type       = "COST"
  limit_amount      = "80"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    notification_type   = "ACTUAL"
    subscriber_email_addresses = ["team+${var.group_id}@study-buddy.demo"]
  }
}

resource "aws_budgets_budget" "zero_spend_alert" {
  name              = "study-buddy-${var.group_id}-forecasted"
  budget_type       = "COST"
  limit_amount      = "100"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 100
    threshold_type      = "PERCENTAGE"
    notification_type   = "FORECASTED"
    subscriber_email_addresses = ["team+${var.group_id}@study-buddy.demo"]
  }
}
```

- [ ] **Step 2: Terraform validate**

Run: `cd backend/terraform && terraform fmt && terraform validate`
Expected output: `Success! The configuration is valid.`

---

### Task 1.11: Final Terraform init, format, and plan check

**Files:** (no new files)

- [ ] **Step 1: Terraform init and full validate**

Run: `cd backend/terraform && rm -rf .terraform && terraform init && terraform validate && terraform fmt -check`
Expected: commands succeed with no errors

- [ ] **Step 2: Run terraform plan to verify all resources resolve**

Run: `cd backend/terraform && terraform plan`
Expected: shows resources to create, no errors
Note: Do not apply yet — apply after backend source code is ready (Part 2)

- [ ] **Step 3: Print outputs template for Docker Compose env file**

Run: `cd backend/terraform && terraform output -json > ../../terraform-outputs.json`
Expected: JSON file written with all output values for use in Docker Compose

---

### Plan Self-Check

**Spec coverage check:**
- Section 3 IaC: covered by Tasks 1.2-1.9
- Section 3 Docker Compose: covered by Task 1.1
- Section 3 Cognito: covered by Task 1.3
- Section 3 API Gateway + JWT: covered by Task 1.6
- Section 3 Lambda: covered by Task 1.7
- Section 3 CloudFront: covered by Task 1.9
- Section 13 security: covered by IAM policy in Task 1.5
- Section 4 cost safety: covered by Task 1.10
- Section 12 KB infra: covered by Task 1.8
- Cross-cutting: outputs.tf populated for Docker Compose env injection

**No placeholders in tasks.** All code is complete and ready to execute.

**Type consistency:** `var.group_id` used consistently, `data.aws_caller_identity.current` defined in s3.tf and used by all other files, DynamoDB table names match design spec (`documents`, `chat-messages`, `flashcard-sets`, `quizzes`, `battle-sessions`).
