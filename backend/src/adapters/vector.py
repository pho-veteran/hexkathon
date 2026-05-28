from __future__ import annotations

from typing import Any

import boto3


class BedrockKBRetriever:
    def __init__(self, kb_id: str, region: str):
        if not kb_id:
            raise ValueError("VECTOR_BEDROCK_KB_ID is required")
        self.kb_id = kb_id
        self.client = boto3.client("bedrock-agent-runtime", region_name=region)

    def build_filter(self, user_id: str, doc_ids: list[str]) -> dict:
        if len(doc_ids) == 1:
            return {
                "andAll": [
                    {"equals": {"key": "user_id", "value": user_id}},
                    {"equals": {"key": "doc_id", "value": doc_ids[0]}},
                ]
            }
        return {
            "andAll": [
                {"equals": {"key": "user_id", "value": user_id}},
                {
                    "orAll": [
                        {"equals": {"key": "doc_id", "value": doc_id}}
                        for doc_id in doc_ids
                    ]
                },
            ]
        }

    def retrieve(
        self,
        query: str,
        user_id: str,
        doc_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        kwargs = {
            "knowledgeBaseId": self.kb_id,
            "retrievalQuery": {"text": query},
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {
                    "numberOfResults": top_k,
                }
            },
        }
        if doc_ids:
            kwargs["retrievalConfiguration"]["vectorSearchConfiguration"]["filter"] = self.build_filter(user_id, doc_ids)

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
