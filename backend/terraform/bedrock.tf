resource "aws_s3vectors_vector_bucket" "bedrock_kb" {
  vector_bucket_name = "study-buddy-${var.group_id}-kb-${var.environment}"
  force_destroy      = true
}

resource "aws_s3vectors_index" "bedrock_kb" {
  index_name         = "study-buddy-kb-index"
  vector_bucket_name = aws_s3vectors_vector_bucket.bedrock_kb.vector_bucket_name
  data_type          = "float32"
  dimension          = 1024
  distance_metric    = "cosine"
}

resource "aws_bedrockagent_knowledge_base" "main" {
  name     = "study-buddy-${var.group_id}-${var.environment}"
  role_arn = aws_iam_role.bedrock_kb.arn

  knowledge_base_configuration {
    type = "VECTOR"

    vector_knowledge_base_configuration {
      embedding_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/cohere.embed-english-v3"
    }
  }

  storage_configuration {
    type = "S3_VECTORS"

    s3_vectors_configuration {
      index_arn = aws_s3vectors_index.bedrock_kb.index_arn
    }
  }
}

resource "aws_bedrockagent_data_source" "uploads" {
  knowledge_base_id = aws_bedrockagent_knowledge_base.main.id
  name              = "study-buddy-${var.group_id}-uploads-${var.environment}"
  data_deletion_policy = "RETAIN"

  data_source_configuration {
    type = "S3"

    s3_configuration {
      bucket_arn         = aws_s3_bucket.uploads.arn
      inclusion_prefixes = ["users/"]
    }
  }

  vector_ingestion_configuration {
    chunking_configuration {
      chunking_strategy = "FIXED_SIZE"

      fixed_size_chunking_configuration {
        max_tokens         = 512
        overlap_percentage = 20
      }
    }
  }
}
