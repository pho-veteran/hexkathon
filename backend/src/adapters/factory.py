from __future__ import annotations

from src.adapters.ai import BedrockAIClient
from src.adapters.storage import S3Storage
from src.adapters.userstore import (
    BattleSessionsStore,
    ChatMessagesStore,
    ChatThreadsStore,
    DocumentsStore,
    FlashcardSetsStore,
    ProjectsStore,
    QuizzesStore,
)
from src.adapters.vector import BedrockKBIngestionClient, BedrockKBRetriever
from src.config import config


# Keep request-time dependency functions that call factories.
# No import-time singletons.
def make_storage() -> S3Storage:
    return S3Storage(config.storage_bucket, config.aws_region)



def make_documents_store() -> DocumentsStore:
    return DocumentsStore(config.documents_table, config.aws_region)



def make_projects_store() -> ProjectsStore:
    return ProjectsStore(config.projects_table, config.aws_region)



def make_chat_threads_store() -> ChatThreadsStore:
    return ChatThreadsStore(config.chat_threads_table, config.aws_region)



def make_chat_messages_store() -> ChatMessagesStore:
    return ChatMessagesStore(config.chat_messages_table, config.aws_region)



def make_flashcard_sets_store() -> FlashcardSetsStore:
    return FlashcardSetsStore(config.flashcard_sets_table, config.aws_region)



def make_quizzes_store() -> QuizzesStore:
    return QuizzesStore(config.quizzes_table, config.aws_region)



def make_battle_sessions_store() -> BattleSessionsStore:
    return BattleSessionsStore(config.battle_sessions_table, config.aws_region)



def make_retriever() -> BedrockKBRetriever:
    return BedrockKBRetriever(config.vector_bedrock_kb_id, config.aws_region)



def make_ingestion_client() -> BedrockKBIngestionClient:
    return BedrockKBIngestionClient(
        config.vector_bedrock_kb_id,
        config.vector_bedrock_data_source_id,
        config.aws_region,
    )



def make_ai_client() -> BedrockAIClient:
    return BedrockAIClient(config.ai_model_id, config.aws_region)
