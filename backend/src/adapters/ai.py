from __future__ import annotations

import json

import boto3


SYSTEM_PROMPT = """You are a study assistant. Answer the student's question using ONLY the context retrieved from their uploaded documents. Cite sources by filename when relevant. If the context does not contain the answer, say so plainly. Do not invent information."""


class BedrockAIClient:
    def __init__(self, model_id: str, region: str):
        self.model_id = model_id
        self.client = boto3.client("bedrock-runtime", region_name=region)

    def build_payload(self, user_prompt: str, max_tokens: int = 1024) -> dict:
        return {
            "modelId": self.model_id,
            "contentType": "application/json",
            "accept": "application/json",
            "body": {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_prompt}],
            },
        }

    def build_grounded_prompt(self, question: str, context: str, citations: list[dict] | None = None) -> str:
        citation_text = ""
        if citations:
            parts = []
            for citation in citations:
                parts.append(f"[{citation.get('filename', 'source')}]: {citation.get('excerpt', '')}")
            citation_text = "\n\nRelevant excerpts:\n" + "\n".join(parts)

        return (
            f"Context:\n{context}\n"
            f"{citation_text}\n\n"
            f"Question: {question}\n\n"
            f"Answer using only the context above."
        )

    def invoke(self, prompt: str, max_tokens: int = 1024) -> str:
        payload = self.build_payload(prompt, max_tokens)
        response = self.client.invoke_model(
            modelId=payload["modelId"],
            contentType=payload["contentType"],
            accept=payload["accept"],
            body=json.dumps(payload["body"]),
        )
        response_body = json.loads(response["body"].read())
        return response_body.get("content", [{}])[0].get("text", "")
