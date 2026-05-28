from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    aws_region: str = Field(default="ap-southeast-1", alias="AWS_REGION")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    storage_backend: str = Field(default="s3", alias="STORAGE_BACKEND")
    storage_bucket: str = Field(default="", alias="STORAGE_BUCKET")

    userstore_backend: str = Field(default="dynamodb", alias="USERSTORE_BACKEND")
    documents_table: str = Field(default="documents", alias="DOCUMENTS_TABLE")
    projects_table: str = Field(default="projects", alias="PROJECTS_TABLE")
    chat_threads_table: str = Field(default="chat-threads", alias="CHAT_THREADS_TABLE")
    chat_messages_table: str = Field(default="chat-messages", alias="CHAT_MESSAGES_TABLE")
    flashcard_sets_table: str = Field(default="", alias="FLASHCARD_SETS_TABLE")
    quizzes_table: str = Field(default="", alias="QUIZZES_TABLE")
    battle_sessions_table: str = Field(default="", alias="BATTLE_SESSIONS_TABLE")

    vector_backend: str = Field(default="bedrock_kb", alias="VECTOR_BACKEND")
    vector_bedrock_kb_id: str = Field(default="", alias="VECTOR_BEDROCK_KB_ID")
    vector_bedrock_data_source_id: str = Field(default="", alias="VECTOR_BEDROCK_DATA_SOURCE_ID")
    ai_backend: str = Field(default="bedrock", alias="AI_BACKEND")
    ai_model_id: str = Field(default="anthropic.claude-3-haiku-20240307-v1:0", alias="AI_MODEL_ID")


config = Settings()
