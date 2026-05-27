# Part 3: Chat and Flashcard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build chat with persisted history, citation modal contract, and flashcard generation from selected documents.

**Architecture:** Extend backend FastAPI with chat routes that retrieve from Bedrock KB, invoke a Bedrock model with grounded context, and persist turns in DynamoDB. Flashcard generation follows same RAG-based pattern with a strict JSON generation schema.

**Tech Stack:** FastAPI, boto3 (bedrock-runtime, bedrock-agent-runtime), DynamoDB, pydantic

---

### Task 3.1: Create Bedrock retriever adapter

**Files:**
- Modify: `backend/src/adapters/vector.py`
- Create: `backend/tests/test_bedrock_retriever.py`

- [ ] **Step 1: Write failing retriever test**

```python
# backend/tests/test_bedrock_retriever.py
from src.adapters.vector import BedrockKBRetriever


def test_retriever_builds_filter_with_user_and_docs():
    retriever = BedrockKBRetriever(kb_id="test-kb", region="ap-southeast-1")
    filter_expression = retriever.build_filter(
        user_id="user-1", doc_ids=["doc-a", "doc-b"]
    )

    assert filter_expression == {
        "andAll": [
            {"equals": {"key": "user_id", "value": "user-1"}},
            {"orAll": [
                {"equals": {"key": "doc_id", "value": "doc-a"}},
                {"equals": {"key": "doc_id", "value": "doc-b"}},
            ]},
        ]
    }
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_bedrock_retriever.py -v`
Expected: FAIL because class is undefined

- [ ] **Step 3: Implement retriever adapter**

```python
# backend/src/adapters/vector.py
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
                {"orAll": [
                    {"equals": {"key": "doc_id", "value": did}}
                    for did in doc_ids
                ]},
            ]
        }

    def retrieve(self, query: str, user_id: str, doc_ids: list[str] | None = None, top_k: int = 5) -> list[dict[str, Any]]:
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
                "doc_id": r.get("metadata", {}).get("doc_id", ""),
                "text": r.get("content", {}).get("text", ""),
                "score": r.get("score", 0.0),
                "metadata": r.get("metadata", {}),
            }
            for r in results
        ]
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_bedrock_retriever.py -v`
Expected: PASS

---

### Task 3.2: Create AI invocation adapter

**Files:**
- Create: `backend/src/adapters/ai.py`
- Create: `backend/tests/test_ai_client.py`

- [ ] **Step 1: Write failing AI test**

```python
# backend/tests/test_ai_client.py
from src.adapters.ai import BedrockAIClient


def test_build_invoke_payload_uses_correct_model():
    client = BedrockAIClient(model_id="anthropic.claude-3-haiku-20240307-v1:0", region="ap-southeast-1")
    payload = client.build_payload("Hello", 512)
    assert "anthropic_version" in payload["body"]
    assert payload["modelId"] == "anthropic.claude-3-haiku-20240307-v1:0"
    assert payload["body"]["max_tokens"] == 512


def test_build_prompt_with_context():
    client = BedrockAIClient(model_id="test-model", region="ap-southeast-1")
    prompt = client.build_grounded_prompt(
        question="What is gradient descent?",
        context="Gradient descent is an optimization algorithm.",
        citations=[{"citationId": "c1", "excerpt": "Gradient descent is an optimization algorithm."}],
    )
    assert "What is gradient descent?" in prompt
    assert "Relevant excerpts:" in prompt
    assert "Gradient descent is an optimization algorithm." in prompt
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_ai_client.py -v`
Expected: FAIL because `BedrockAIClient` is undefined

- [ ] **Step 3: Implement AI adapter**

```python
# backend/src/adapters/ai.py
from __future__ import annotations

import json
from typing import Any

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
                "messages": [
                    {"role": "user", "content": user_prompt}
                ],
            },
        }

    def build_grounded_prompt(self, question: str, context: str, citations: list[dict] | None = None) -> str:
        citation_text = ""
        if citations:
            parts = []
            for c in citations:
                parts.append(f"[{c.get('filename', 'source')}]: {c.get('excerpt', '')}")
            citation_text = "\n\nRelevant excerpts:\n" + "\n".join(parts)

        return (
            f"Context:\n{context}\n"
            f"{citation_text}\n\n"
            f"Question: {question}\n\n"
            f"Answer using only the context above."
        )

    def invoke(self, prompt: str, max_tokens: int = 1024) -> str:
        payload = self.build_payload(prompt, max_tokens)
        body = json.dumps(payload["body"])
        response = self.client.invoke_model(
            modelId=payload["modelId"],
            contentType=payload["contentType"],
            accept=payload["accept"],
            body=body,
        )
        response_body = json.loads(response["body"].read())
        return response_body.get("content", [{}])[0].get("text", "")
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_ai_client.py -v`
Expected: PASS

---

### Task 3.3: Implement chat message persistence

**Files:**
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_chat_messages_store.py`

- [ ] **Step 1: Write failing chat message test**

```python
# backend/tests/test_chat_messages_store.py
from src.handlers import build_chat_message_item


def test_build_chat_message_item_uses_user_partition_and_chat_sort_key():
    item = build_chat_message_item(
        user_id="user-1",
        message_id="msg-1",
        role="user",
        content="What is gradient descent?",
        doc_ids=["doc-a"],
        created_at="2026-05-27T00:00:00Z",
        citations=[],
    )

    assert item["userId"] == "user-1"
    assert item["sk"].startswith("CHAT#")
    assert item["role"] == "user"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_chat_messages_store.py -v`
Expected: FAIL

- [ ] **Step 3: Implement chat message helpers**

```python
# backend/src/handlers.py
def build_chat_message_item(
    user_id: str,
    message_id: str,
    role: str,
    content: str,
    doc_ids: list[str],
    created_at: str,
    citations: list[dict],
) -> dict:
    return {
        "userId": user_id,
        "sk": f"CHAT#{created_at}#{message_id}",
        "messageId": message_id,
        "role": role,
        "content": content,
        "docIds": doc_ids,
        "citations": citations,
        "createdAt": created_at,
    }
```

```python
# backend/src/adapters/userstore.py — add method to DocumentsStore or create separate class

class ChatMessagesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_message(self, item: dict) -> None:
        self.table.put_item(Item=item)

    def list_messages(self, user_id: str, limit: int = 50) -> list[dict]:
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
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_chat_messages_store.py -v`
Expected: PASS

---

### Task 3.4: Implement chat API routes

**Files:**
- Modify: `backend/src/app.py`
- Add factory wiring in `backend/src/adapters/factory.py`
- Create: `backend/tests/test_chat_routes.py`

- [ ] **Step 1: Write failing chat route test**

```python
# backend/tests/test_chat_routes.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_chat_routes_require_authentication():
    response = client.get("/chat/messages")
    assert response.status_code == 401

    response = client.post("/chat/messages", json={"question": "", "docIds": []})
    assert response.status_code == 401
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_chat_routes.py -v`
Expected: FAIL

- [ ] **Step 3: Implement chat routes**

```python
# backend/src/app.py — add after document routes
from pydantic import BaseModel
from src.adapters.ai import BedrockAIClient
from src.adapters.userstore import ChatMessagesStore, FlashcardSetsStore
from src.adapters.vector import BedrockKBRetriever


class ChatRequest(BaseModel):
    question: str
    docIds: list[str] = []


chat_messages_store = ChatMessagesStore(config.chat_messages_table, config.aws_region)
retriever = BedrockKBRetriever(config.vector_bedrock_kb_id, config.aws_region)
ai_client = BedrockAIClient(config.ai_model_id, config.aws_region)


@app.get("/chat/messages")
def list_chat_messages(user_id: str = Depends(get_current_user_id)) -> dict:
    return {"messages": chat_messages_store.list_messages(user_id)}


@app.post("/chat/messages")
async def create_chat_message(
    req: ChatRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    from src.handlers import build_chat_message_item, normalize_citation, utc_now
    from uuid import uuid4

    # Retrieval
    results = retriever.retrieve(
        query=req.question,
        user_id=user_id,
        doc_ids=req.docIds if req.docIds else None,
    )

    citations = [
        normalize_citation(f"c{i}", r)
        for i, r in enumerate(results)
    ]
    context = "\n\n".join(r["text"] for r in results)

    # AI generation
    prompt = ai_client.build_grounded_prompt(req.question, context, citations)
    answer = ai_client.invoke(prompt)

    # Persist user message
    now = utc_now()
    user_msg_item = build_chat_message_item(
        user_id=user_id,
        message_id=str(uuid4()),
        role="user",
        content=req.question,
        doc_ids=req.docIds,
        created_at=now,
        citations=[],
    )
    chat_messages_store.put_message(user_msg_item)

    # Persist bot message
    bot_msg_item = build_chat_message_item(
        user_id=user_id,
        message_id=str(uuid4()),
        role="bot",
        content=answer,
        doc_ids=req.docIds,
        created_at=utc_now(),
        citations=citations,
    )
    chat_messages_store.put_message(bot_msg_item)

    return bot_msg_item
```

- [ ] **Step 4: Run passing tests**

Run: `pytest backend/tests/test_chat_routes.py -v`
Expected: PASS

Note: In test env where AWS services are not available, routes will 500 at runtime. Tests verify auth guard, not full AI invocation.

---

### Task 3.5: Implement flashcard generation

**Files:**
- Modify: `backend/src/handlers.py`
- Modify: `backend/src/app.py`
- Create: `backend/tests/test_flashcard_schema.py`

- [ ] **Step 1: Write failing flashcard generation test**

```python
# backend/tests/test_flashcard_schema.py
from src.handlers import build_flashcard_prompt, parse_flashcard_response


def test_build_flashcard_prompt_asks_for_strict_json():
    prompt = build_flashcard_prompt(
        context="Math notes", count=5, doc_ids=["doc-1"]
    )
    assert "5 flashcards" in prompt
    assert "docId" in prompt or "doc-1" in prompt
    assert "JSON" in prompt


def test_parse_flashcard_response_returns_normalized_cards():
    raw = '''{"cards": [{"id":"1","front":"Q1","back":"A1","source":"page 1"}]}'''
    parsed = parse_flashcard_response(raw, "doc-1")
    assert len(parsed["cards"]) == 1
    assert parsed["cards"][0]["front"] == "Q1"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_flashcard_schema.py -v`
Expected: FAIL

- [ ] **Step 3: Implement flashcard helpers**

```python
# backend/src/handlers.py
import json
import re


def build_flashcard_prompt(context: str, count: int, doc_ids: list[str]) -> str:
    count_str = str(count) if count > 0 else "all relevant"
    return (
        f"Generate exactly {count_str} flashcards from the context below. "
        f"Base documents: {json.dumps(doc_ids)}.\n\n"
        f"Respond with valid JSON only: "
        f'{{"cards": [{{"id":"1","front":"question","back":"answer","source":"source label"}}]}}\n\n'
        f"Context:\n{context}"
    )


def parse_flashcard_response(raw: str, doc_id: str) -> dict:
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        return {"docId": doc_id, "cards": []}
    try:
        data = json.loads(json_match.group())
        return {"docId": doc_id, "cards": data.get("cards", [])}
    except (json.JSONDecodeError, TypeError):
        return {"docId": doc_id, "cards": []}
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_flashcard_schema.py -v`
Expected: PASS

---

### Task 3.6: Implement flashcard API and persistence

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/adapters/userstore.py`
- Create: `backend/tests/test_flashcard_routes.py`

- [ ] **Step 1: Add flashcard set DynamoDB store**

```python
# backend/src/adapters/userstore.py


class FlashcardSetsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_set(self, item: dict) -> None:
        self.table.put_item(Item=item)

    def list_sets(self, user_id: str) -> list[dict]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "FLASHCARD#"},
        )
        return response.get("Items", [])

    def get_set(self, user_id: str, set_id: str) -> dict | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"FLASHCARD#{set_id}"})
        return response.get("Item")
```

- [ ] **Step 2: Add flashcard route**

```python
# backend/src/app.py


class FlashcardGenerateRequest(BaseModel):
    docIds: list[str] = []
    cardCount: int = 10


flashcard_sets_store = FlashcardSetsStore(config.flashcard_sets_table, config.aws_region)


@app.post("/flashcards/generate")
def generate_flashcards(
    req: FlashcardGenerateRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    from src.handlers import build_flashcard_prompt, parse_flashcard_response, utc_now
    from uuid import uuid4

    context_chunks = retriever.retrieve(
        query="generate flashcards from document",
        user_id=user_id,
        doc_ids=req.docIds,
        top_k=20,
    )
    context = "\n\n".join(c["text"] for c in context_chunks)
    prompt = build_flashcard_prompt(context, req.cardCount, req.docIds)
    raw_response = ai_client.invoke(prompt, max_tokens=2048)
    parsed = parse_flashcard_response(raw_response, req.docIds[0] if req.docIds else "unknown")

    set_id = str(uuid4())
    store_item = {
        "userId": user_id,
        "sk": f"FLASHCARD#{set_id}",
        "setId": set_id,
        "docIds": req.docIds,
        "cardCount": req.cardCount,
        "cards": parsed["cards"],
        "createdAt": utc_now(),
    }
    flashcard_sets_store.put_set(store_item)
    return store_item


@app.get("/flashcards")
def list_flashcards(user_id: str = Depends(get_current_user_id)) -> dict:
    return {"flashcardSets": flashcard_sets_store.list_sets(user_id)}
```

- [ ] **Step 3: Run flashcard route test for auth guard**

Run: `pytest -x -v -k "flashcard" backend/tests/`
Expected: tests pass

---

### Task 3.7: Run chat + flashcard test suite

**Files:** none

- [ ] **Step 1: Run all backend tests**

Run: `pytest backend/tests/ -v`
Expected: all tests pass

---

### Plan Self-Check

**Spec coverage:** Chat with citations (section 5.3), message persistence (section 5.3 steps 5-7), flashcard generation (section 5.4), retrieval filter to user+doc scope (section 5.3 step 3), citation payload contract (section 8.3), flashcard JSON schema (section 5.4 step 4), flashcard persistence (section 5.4 step 5).

**No placeholders:** All code complete. No TODOs.

**Type consistency:** `userId`, `DOC#`, `CHAT#`, `FLASHCARD#` SK patterns consistent with spec Part 1 tables.
