from __future__ import annotations

from typing import Any

import boto3


class BedrockKBRetriever:
    def __init__(self, kb_id: str, region: str):
        if not kb_id:
            raise ValueError("VECTOR_BEDROCK_KB_ID is required")
        self.kb_id = kb_id
        self.client = boto3.client("bedrock-agent-runtime", region_name=region)

    def retrieve(
        self,
        query: str,
        user_id: str,
        project_id: str | None = None,
        doc_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        kwargs: dict[str, Any] = {
            "knowledgeBaseId": self.kb_id,
            "retrievalQuery": {"text": query},
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {
                    "numberOfResults": top_k,
                }
            },
        }

        response = self.client.retrieve(**kwargs)
        results = response.get("retrievalResults", [])
        return [
            {
                "doc_id": result.get("metadata", {}).get("doc_id", ""),
                "text": result.get("content", {}).get("text", ""),
                "score": result.get("score", 0.0),
                "metadata": result.get("metadata", {}),
            }
            for result in results
        ]


class BedrockKBIngestionClient:
    def __init__(self, kb_id: str, data_source_id: str, region: str):
        if not kb_id:
            raise ValueError("VECTOR_BEDROCK_KB_ID is required")
        if not data_source_id:
            raise ValueError("VECTOR_BEDROCK_DATA_SOURCE_ID is required")
        self.kb_id = kb_id
        self.data_source_id = data_source_id
        self.client = boto3.client("bedrock-agent", region_name=region)

    def start_ingestion_job(self) -> str:
        response = self.client.start_ingestion_job(
            knowledgeBaseId=self.kb_id,
            dataSourceId=self.data_source_id,
        )
        return response["ingestionJob"]["ingestionJobId"]

    def get_latest_status(self) -> dict[str, str] | None:
        response = self.client.list_ingestion_jobs(
            knowledgeBaseId=self.kb_id,
            dataSourceId=self.data_source_id,
            maxResults=1,
        )
        jobs = response.get("ingestionJobSummaries", [])
        if not jobs:
            return None
        latest = jobs[0]
        return {
            "jobId": latest.get("ingestionJobId", ""),
            "status": latest.get("status", ""),
        }

    def map_document_status(self) -> str:
        latest = self.get_latest_status()
        if not latest:
            return "processing"
        status = latest["status"]
        if status == "COMPLETE":
            return "ready"
        if status in {"FAILED", "STOPPED"}:
            return "failed"
        return "processing"

    def build_filter(self, user_id: str, project_id: str | None, doc_ids: list[str] | None) -> dict:
        clauses: list[dict[str, Any]] = [
            {"equals": {"key": "user_id", "value": user_id}},
        ]
        if project_id:
            clauses.append({"equals": {"key": "project_id", "value": project_id}})
        if doc_ids:
            if len(doc_ids) == 1:
                clauses.append({"equals": {"key": "doc_id", "value": doc_ids[0]}})
            else:
                clauses.append({
                    "orAll": [
                        {"equals": {"key": "doc_id", "value": doc_id}}
                        for doc_id in doc_ids
                    ]
                })
        return {"andAll": clauses}

    def retrieve(
        self,
        query: str,
        user_id: str,
        project_id: str | None = None,
        doc_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        kwargs = {
            "knowledgeBaseId": self.kb_id,
            "retrievalQuery": {"text": query},
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {
                    "numberOfResults": top_k,
                    "filter": self.build_filter(user_id, project_id, doc_ids),
                }
            },
        }

        response = self.client.retrieve(**kwargs)
        results = response.get("retrievalResults", [])
        return [
            {
                "doc_id": result.get("metadata", {}).get("doc_id", ""),
                "text": result.get("content", {}).get("text", ""),
                "score": result.get("score", 0.0),
                "metadata": result.get("metadata", {}),
            }
            for result in results
        ]
