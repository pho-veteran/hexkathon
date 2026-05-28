from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import boto3


def _query_items(table: Any, user_id: str, prefix: str, *, scan_index_forward: bool | None = None, limit: int | None = None) -> list[dict[str, Any]]:
    kwargs: dict[str, Any] = {
        "KeyConditionExpression": "userId = :user_id AND begins_with(sk, :prefix)",
        "ExpressionAttributeValues": {":user_id": user_id, ":prefix": prefix},
    }
    if scan_index_forward is not None:
        kwargs["ScanIndexForward"] = scan_index_forward
    if limit is not None:
        kwargs["Limit"] = limit
    response = table.query(**kwargs)
    return response.get("Items", [])


def _delete_items(items: list[dict[str, Any]], deleter: Callable[[dict[str, Any]], None]) -> None:
    for item in items:
        deleter(item)


def build_document_item(
    user_id: str,
    project_id: str,
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
        "sk": f"DOC#{project_id}#{doc_id}",
        "projectId": project_id,
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

    def update_document_status(self, user_id: str, project_id: str, doc_id: str, kb_ingest_status: str) -> None:
        self.table.update_item(
            Key={"userId": user_id, "sk": f"DOC#{project_id}#{doc_id}"},
            UpdateExpression="SET kbIngestStatus = :status",
            ExpressionAttributeValues={":status": kb_ingest_status},
        )

    def update_documents_status_for_project(self, user_id: str, project_id: str, kb_ingest_status: str) -> None:
        for item in self.list_documents(user_id, project_id):
            self.update_document_status(user_id, project_id, item["docId"], kb_ingest_status)

    def list_ready_documents(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        return [item for item in self.list_documents(user_id, project_id) if item.get("kbIngestStatus") == "ready"]

    def list_documents(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"DOC#{project_id}#"},
        )
        return response.get("Items", [])

    def get_document(self, user_id: str, project_id: str, doc_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"DOC#{project_id}#{doc_id}"})
        return response.get("Item")

    def delete_documents_for_project(self, user_id: str, project_id: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, f"DOC#{project_id}#", limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )


@dataclass
class ProjectsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_project(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_projects(self, user_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "PROJECT#"},
        )
        return response.get("Items", [])

    def get_project(self, user_id: str, project_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"PROJECT#{project_id}"})
        return response.get("Item")

    def delete_project(self, user_id: str, project_id: str) -> None:
        self.table.delete_item(Key={"userId": user_id, "sk": f"PROJECT#{project_id}"})


@dataclass
class ChatThreadsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_thread(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_threads(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"THREAD#{project_id}#"},
            ScanIndexForward=False,
        )
        return response.get("Items", [])

    def get_thread(self, user_id: str, project_id: str, thread_id: str) -> dict[str, Any] | None:
        for item in self.list_threads(user_id, project_id):
            if item.get("threadId") == thread_id:
                return item
        return None

    def delete_threads_for_project(self, user_id: str, project_id: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, f"THREAD#{project_id}#", limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )


@dataclass
class ChatMessagesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_message(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_messages(self, user_id: str, project_id: str, thread_id: str, limit: int = 50) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"CHAT#{project_id}#{thread_id}#"},
            ScanIndexForward=False,
            Limit=limit,
        )
        return list(reversed(response.get("Items", [])))

    def delete_messages(self, user_id: str, project_id: str, thread_id: str) -> None:
        items = self.list_messages(user_id, project_id, thread_id, limit=1000)
        for item in items:
            self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]})

    def delete_messages_for_project(self, user_id: str, project_id: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, f"CHAT#{project_id}#", limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )


@dataclass
class FlashcardSetsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_set(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_sets(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"FLASHCARD#{project_id}#"},
        )
        return response.get("Items", [])

    def get_set(self, user_id: str, project_id: str, set_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"FLASHCARD#{project_id}#{set_id}"})
        return response.get("Item")

    def delete_sets_for_project(self, user_id: str, project_id: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, f"FLASHCARD#{project_id}#", limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )


@dataclass
class QuizzesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_quiz(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def list_quizzes(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"QUIZ#{project_id}#"},
        )
        return response.get("Items", [])

    def get_quiz(self, user_id: str, project_id: str, quiz_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"QUIZ#{project_id}#{quiz_id}"})
        return response.get("Item")

    def delete_quizzes_for_project(self, user_id: str, project_id: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, f"QUIZ#{project_id}#", limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )


@dataclass
class BattleSessionsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def _delete_by_prefix(self, user_id: str, prefix: str) -> None:
        _delete_items(
            _query_items(self.table, user_id, prefix, limit=1000),
            lambda item: self.table.delete_item(Key={"userId": user_id, "sk": item["sk"]}),
        )

    def put_session(self, item: dict[str, Any]) -> None:
        self.table.put_item(Item=item)

    def get_session(self, user_id: str, project_id: str, session_id: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"BATTLE#{project_id}#{session_id}"})
        return response.get("Item")

    def list_sessions(self, user_id: str, project_id: str) -> list[dict[str, Any]]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": f"BATTLE#{project_id}#"},
        )
        return response.get("Items", [])

    def delete_sessions_for_project(self, user_id: str, project_id: str) -> None:
        self._delete_by_prefix(user_id, f"BATTLE#{project_id}#")
