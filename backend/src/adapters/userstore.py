from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import boto3


def build_document_item(
    user_id: str,
    doc_id: str,
    filename: str,
    s3_key: str,
    content_type: str,
    kb_ingest_status: str,
    upload_status: str,
    created_at: str,
) -> dict[str, Any]:
    return {
        "userId": user_id,
        "sk": f"DOC#{doc_id}",
        "docId": doc_id,
        "filename": filename,
        "s3Key": s3_key,
        "contentType": content_type,
        "kbIngestStatus": kb_ingest_status,
        "uploadStatus": upload_status,
        "createdAt": created_at,
    }


@dataclass
class DocumentsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_document(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_documents(self, user_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "DOC#"},
        )
        return response.get("Items", [])

    def get_document(self, user_id: str, doc_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"DOC#{doc_id}"})
        return response.get("Item")


@dataclass
class ChatMessagesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_message(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_messages(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "CHAT#"},
            ScanIndexForward=False,
            Limit=limit,
        )
        return list(reversed(response.get("Items", [])))

    def delete_messages(self, user_id: str) -> None:
        items = self.list_messages(user_id, limit=1000)
        for item in items:
            self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]})


@dataclass
class FlashcardSetsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_set(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_sets(self, user_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "FLASHCARD#"},
        )
        return response.get("Items", [])

    def get_set(self, user_id: str, set_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"FLASHCARD#{set_id}"})
        return response.get("Item")


@dataclass
class QuizzesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_quiz(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_quizzes(self, user_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "QUIZ#"},
        )
        return response.get("Items", [])

    def get_quiz(self, user_id: str, quiz_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"QUIZ#{quiz_id}"})
        return response.get("Item")


@dataclass
class BattleSessionsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_session(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def get_session(self, user_id: str, session_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"BATTLE#{session_id}"})
        return response.get("Item")

    def list_sessions(self, user_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "BATTLE#"},
        )
        return response.get("Items", [])
