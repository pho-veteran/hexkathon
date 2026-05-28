resource "aws_opensearchserverless_security_policy" "bedrock_kb_encryption" {
  name = "study-buddy-${var.group_id}-kb-encryption-${var.environment}"
  type = "encryption"

  policy = jsonencode({
    Rules = [
      {
        ResourceType = "collection"
        Resource     = ["collection/study-buddy-${var.group_id}-kb-${var.environment}"]
      }
    ]
    AWSOwnedKey = true
  })
}

resource "aws_opensearchserverless_security_policy" "bedrock_kb_network" {
  name = "study-buddy-${var.group_id}-kb-network-${var.environment}"
  type = "network"

  policy = jsonencode([
    {
      Description = "Allow public access for MVP knowledge base setup"
      Rules = [
        {
          ResourceType = "collection"
          Resource     = ["collection/study-buddy-${var.group_id}-kb-${var.environment}"]
        },
        {
          ResourceType = "dashboard"
          Resource     = ["collection/study-buddy-${var.group_id}-kb-${var.environment}"]
        }
      ]
      AllowFromPublic = true
    }
  ])
}

resource "aws_opensearchserverless_collection" "bedrock_kb" {
  name = "study-buddy-${var.group_id}-kb-${var.environment}"
  type = "VECTORSEARCH"

  depends_on = [
    aws_opensearchserverless_security_policy.bedrock_kb_encryption,
    aws_opensearchserverless_security_policy.bedrock_kb_network,
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
          Resource     = ["index/${aws_opensearchserverless_collection.bedrock_kb.name}/*"]
          Permission   = ["aoss:CreateIndex", "aoss:DeleteIndex", "aoss:DescribeIndex", "aoss:ReadDocument", "aoss:UpdateIndex", "aoss:WriteDocument"]
        },
        {
          ResourceType = "collection"
          Resource     = ["collection/${aws_opensearchserverless_collection.bedrock_kb.name}"]
          Permission   = ["aoss:CreateCollectionItems", "aoss:DeleteCollectionItems", "aoss:DescribeCollectionItems", "aoss:UpdateCollectionItems"]
        }
      ]
      Principal = [
        aws_iam_role.bedrock_kb.arn,
        aws_iam_role.lambda_exec.arn,
      ]
    }
  ])
}

resource "aws_bedrockagent_knowledge_base" "main" {
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

    opensearch_serverless_configuration {
      collection_arn    = aws_opensearchserverless_collection.bedrock_kb.arn
      vector_index_name = "bedrock-knowledge-base-default-index"

      field_mapping {
        metadata_field = "AMAZON_BEDROCK_METADATA"
        text_field     = "AMAZON_BEDROCK_TEXT_CHUNK"
        vector_field   = "bedrock-knowledge-base-default-vector"
      }
    }
  }

  depends_on = [aws_opensearchserverless_access_policy.bedrock_kb]
}
