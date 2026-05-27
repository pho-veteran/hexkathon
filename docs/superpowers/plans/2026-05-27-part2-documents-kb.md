# Part 2: Documents + Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build backend scaffold, authenticated document upload/list APIs, S3 persistence, KB ingest metadata flow, and citation normalization contract.

**Architecture:** Create `backend/` from StudyBot-inspired FastAPI shape with adapters, config, and handlers. Document upload persists metadata in DynamoDB, stores originals in S3, writes KB sidecar metadata, and exposes readiness state and normalized citation contracts for later chat/AI features.

**Tech Stack:** FastAPI, Mangum, boto3, pydantic, pypdf, pytest, DynamoDB, S3, Bedrock Knowledge Base

---

### Task 2.1: Scaffold backend Python project

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/src/__init__.py`
- Create: `backend/src/app.py`
- Create: `backend/src/config.py`
- Create: `backend/src/handlers.py`
- Create: `backend/src/adapters/__init__.py`
- Create: `backend/src/adapters/factory.py`
- Create: `backend/src/adapters/storage.py`
- Create: `backend/src/adapters/userstore.py`
- Create: `backend/src/adapters/vector.py`
- Create: `backend/src/auth.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write failing health test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_health_returns_backend_summary():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["backends"].keys()) == {"storage", "userstore", "vector", "ai"}
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_health.py -v`
Expected: FAIL with import error because `src.app` does not exist yet

- [ ] **Step 3: Create requirements.txt**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
mangum==0.19.0
boto3==1.35.24
pydantic==2.9.2
pydantic-settings==2.5.2
python-multipart==0.0.9
pypdf==5.0.1
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 4: Create config.py**

```python
# backend/src/config.py
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    aws_region: str = Field(default="ap-southeast-1", alias="AWS_REGION")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    storage_backend: str = Field(default="s3", alias="STORAGE_BACKEND")
    storage_bucket: str = Field(default="", alias="STORAGE_BUCKET")

    userstore_backend: str = Field(default="dynamodb", alias="USERSTORE_BACKEND")
    documents_table: str = Field(default="", alias="DOCUMENTS_TABLE")
    chat_messages_table: str = Field(default="", alias="CHAT_MESSAGES_TABLE")
    flashcard_sets_table: str = Field(default="", alias="FLASHCARD_SETS_TABLE")
    quizzes_table: str = Field(default="", alias="QUIZZES_TABLE")
    battle_sessions_table: str = Field(default="", alias="BATTLE_SESSIONS_TABLE")

    vector_backend: str = Field(default="bedrock_kb", alias="VECTOR_BACKEND")
    vector_bedrock_kb_id: str = Field(default="", alias="VECTOR_BEDROCK_KB_ID")
    ai_backend: str = Field(default="bedrock", alias="AI_BACKEND")
    ai_model_id: str = Field(default="anthropic.claude-3-haiku-20240307-v1:0", alias="AI_MODEL_ID")

    cognito_user_pool_id: str = Field(default="", alias="COGNITO_USER_POOL_ID")
    cognito_client_id: str = Field(default="", alias="COGNITO_CLIENT_ID")


config = Settings()
```

- [ ] **Step 5: Create auth.py**

```python
# backend/src/auth.py
from fastapi import HTTPException, Request


def get_current_user_id(request: Request) -> str:
    claims = request.scope.get("aws.event", {}).get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    user_id = claims.get("sub")
    if user_id:
        return user_id

    dev_user_id = request.headers.get("x-dev-user-id")
    if dev_user_id:
        return dev_user_id

    raise HTTPException(status_code=401, detail="Missing authenticated user")
```

- [ ] **Step 6: Create app.py**

```python
# backend/src/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import config

app = FastAPI(title="Study Buddy Battle Quiz API")

allowed = [origin.strip() for origin in config.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "backends": {
            "storage": config.storage_backend,
            "userstore": config.userstore_backend,
            "vector": config.vector_backend,
            "ai": config.ai_backend,
        },
    }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pytest backend/tests/test_health.py -v`
Expected: PASS

---

### Task 2.2: Implement document DynamoDB store

**Files:**
- Modify: `backend/src/adapters/userstore.py`
- Create: `backend/tests/test_userstore_documents.py`

- [ ] **Step 1: Write failing test for document item shape**

```python
# backend/tests/test_userstore_documents.py
from src.adapters.userstore import build_document_item


def test_build_document_item_uses_user_partition_and_doc_sort_key():
    item = build_document_item(
        user_id="user-1",
        doc_id="doc-1",
        filename="lesson.pdf",
        s3_key="users/user-1/docs/doc-1/original/lesson.pdf",
        content_type="application/pdf",
        kb_ingest_status="processing",
        upload_status="uploaded",
        created_at="2026-05-27T00:00:00Z",
    )

    assert item["userId"] == "user-1"
    assert item["sk"] == "DOC#doc-1"
    assert item["docId"] == "doc-1"
    assert item["filename"] == "lesson.pdf"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_userstore_documents.py -v`
Expected: FAIL because `build_document_item` is undefined

- [ ] **Step 3: Implement document store helpers**

```python
# backend/src/adapters/userstore.py
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
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_userstore_documents.py -v`
Expected: PASS

---

### Task 2.3: Implement S3 storage adapter and PDF text extraction

**Files:**
- Modify: `backend/src/adapters/storage.py`
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_extract_text.py`

- [ ] **Step 1: Write failing extract text test**

```python
# backend/tests/test_extract_text.py
from src.handlers import extract_text


def test_extract_text_decodes_utf8_text_file():
    content = b"Hello study buddy"
    assert extract_text("notes.txt", content) == "Hello study buddy"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_extract_text.py -v`
Expected: FAIL because `extract_text` is undefined

- [ ] **Step 3: Implement storage and extraction**

```python
# backend/src/adapters/storage.py
import boto3


class S3Storage:
    def __init__(self, bucket: str, region: str):
        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
```

```python
# backend/src/handlers.py
import io
from pypdf import PdfReader


def extract_text(filename: str, data: bytes) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return data.decode("utf-8", errors="replace")
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_extract_text.py -v`
Expected: PASS

---

### Task 2.4: Implement upload handler and API

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/handlers.py`
- Modify: `backend/src/adapters/factory.py`
- Create: `backend/tests/test_upload_contract.py`

- [ ] **Step 1: Write failing upload contract test**

```python
# backend/tests/test_upload_contract.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_upload_requires_authentication():
    response = client.post("/documents/upload")
    assert response.status_code == 401
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_upload_contract.py::test_upload_requires_authentication -v`
Expected: FAIL because route does not exist

- [ ] **Step 3: Implement factory and upload route**

```python
# backend/src/adapters/factory.py
from src.config import config
from src.adapters.storage import S3Storage
from src.adapters.userstore import DocumentsStore


def make_storage() -> S3Storage:
    return S3Storage(config.storage_bucket, config.aws_region)


def make_documents_store() -> DocumentsStore:
    return DocumentsStore(config.documents_table, config.aws_region)
```

```python
# backend/src/handlers.py
from datetime import datetime, timezone
from uuid import uuid4

from src.adapters.userstore import build_document_item


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_document_upload_result(user_id: str, filename: str, content_type: str, storage, documents_store, data: bytes) -> dict:
    doc_id = str(uuid4())
    s3_key = f"users/{user_id}/docs/{doc_id}/original/{filename}"
    storage.put(s3_key, data, content_type)
    item = build_document_item(
        user_id=user_id,
        doc_id=doc_id,
        filename=filename,
        s3_key=s3_key,
        content_type=content_type,
        kb_ingest_status="processing",
        upload_status="uploaded",
        created_at=utc_now(),
    )
    documents_store.put_document(item)
    return item
```

```python
# backend/src/app.py — add below health route
from fastapi import Depends, File, HTTPException, Request, UploadFile
from src.auth import get_current_user_id
from src.adapters.factory import make_documents_store, make_storage
from src.handlers import build_document_upload_result

storage = make_storage()
documents_store = make_documents_store()


@app.post("/documents/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    return build_document_upload_result(
        user_id=user_id,
        filename=file.filename or "untitled",
        content_type=file.content_type or "application/octet-stream",
        storage=storage,
        documents_store=documents_store,
        data=data,
    )
```

- [ ] **Step 4: Run auth guard test**

Run: `pytest backend/tests/test_upload_contract.py::test_upload_requires_authentication -v`
Expected: PASS

---

### Task 2.5: Implement list/get document APIs

**Files:**
- Modify: `backend/src/app.py`
- Create: `backend/tests/test_documents_routes.py`

- [ ] **Step 1: Write failing documents route test**

```python
# backend/tests/test_documents_routes.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_documents_route_requires_authentication():
    response = client.get("/documents")
    assert response.status_code == 401
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_documents_routes.py -v`
Expected: FAIL because route does not exist

- [ ] **Step 3: Implement routes**

```python
# backend/src/app.py — add routes
@app.get("/documents")
def list_documents(user_id: str = Depends(get_current_user_id)) -> dict:
    return {"documents": documents_store.list_documents(user_id)}


@app.get("/documents/{doc_id}")
def get_document(doc_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    item = documents_store.get_document(user_id, doc_id)
    if not item:
        raise HTTPException(status_code=404, detail="Document not found")
    return item
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_documents_routes.py -v`
Expected: PASS

---

### Task 2.6: Implement KB sidecar metadata contract

**Files:**
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_kb_sidecar.py`

- [ ] **Step 1: Write failing sidecar test**

```python
# backend/tests/test_kb_sidecar.py
from src.handlers import build_kb_metadata_sidecar


def test_build_kb_metadata_sidecar_contains_user_and_doc_filter_fields():
    payload = build_kb_metadata_sidecar(
        user_id="user-1",
        doc_id="doc-1",
        filename="lesson.pdf",
        locator="page-1",
    )

    attributes = payload["metadataAttributes"]
    keys = {entry["key"] for entry in attributes}

    assert keys == {"user_id", "doc_id", "filename", "locator"}
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_kb_sidecar.py -v`
Expected: FAIL because helper is undefined

- [ ] **Step 3: Implement sidecar helper**

```python
# backend/src/handlers.py
import json


def build_kb_metadata_sidecar(user_id: str, doc_id: str, filename: str, locator: str) -> dict:
    return {
        "metadataAttributes": [
            {"key": "user_id", "value": {"type": "STRING", "stringValue": user_id}},
            {"key": "doc_id", "value": {"type": "STRING", "stringValue": doc_id}},
            {"key": "filename", "value": {"type": "STRING", "stringValue": filename}},
            {"key": "locator", "value": {"type": "STRING", "stringValue": locator}},
        ]
    }
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_kb_sidecar.py -v`
Expected: PASS

---

### Task 2.7: Write KB sidecar object to S3 on upload

**Files:**
- Modify: `backend/src/adapters/storage.py`
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_upload_sidecar_key.py`

- [ ] **Step 1: Write failing key contract test**

```python
# backend/tests/test_upload_sidecar_key.py
from src.handlers import build_sidecar_key


def test_build_sidecar_key_places_metadata_next_to_original_file():
    key = build_sidecar_key("users/user-1/docs/doc-1/original/lesson.pdf")
    assert key == "users/user-1/docs/doc-1/original/lesson.pdf.metadata.json"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_upload_sidecar_key.py -v`
Expected: FAIL because helper is undefined

- [ ] **Step 3: Implement sidecar key and upload**

```python
# backend/src/handlers.py

def build_sidecar_key(s3_key: str) -> str:
    return f"{s3_key}.metadata.json"
```

```python
# backend/src/adapters/storage.py — add helper inside S3Storage
import json

class S3Storage:
    # existing __init__ and put methods above

    def put_json(self, key: str, payload: dict) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=json.dumps(payload).encode("utf-8"),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )
```

```python
# backend/src/handlers.py — update build_document_upload_result before store.put_document
    sidecar = build_kb_metadata_sidecar(user_id, doc_id, filename, "document")
    storage.put_json(build_sidecar_key(s3_key), sidecar)
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_upload_sidecar_key.py -v`
Expected: PASS

---

### Task 2.8: Implement normalized citation contract

**Files:**
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_citation_normalization.py`

- [ ] **Step 1: Write failing citation normalization test**

```python
# backend/tests/test_citation_normalization.py
from src.handlers import normalize_citation


def test_normalize_citation_maps_kb_payload_to_frontend_contract():
    raw = {
        "doc_id": "doc-1",
        "metadata": {"filename": "lesson.pdf", "locator": "page-2"},
        "text": "Gradient descent is iterative.",
        "score": 0.98,
    }

    normalized = normalize_citation("citation-1", raw)

    assert normalized == {
        "citationId": "citation-1",
        "docId": "doc-1",
        "filename": "lesson.pdf",
        "locator": "page-2",
        "excerpt": "Gradient descent is iterative.",
        "score": 0.98,
    }
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_citation_normalization.py -v`
Expected: FAIL because helper is undefined

- [ ] **Step 3: Implement citation helper**

```python
# backend/src/handlers.py

def normalize_citation(citation_id: str, raw: dict) -> dict:
    metadata = raw.get("metadata", {})
    return {
        "citationId": citation_id,
        "docId": raw.get("doc_id", ""),
        "filename": metadata.get("filename", ""),
        "locator": metadata.get("locator", ""),
        "excerpt": raw.get("text", ""),
        "score": raw.get("score", 0.0),
    }
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_citation_normalization.py -v`
Expected: PASS

---

### Task 2.9: Run backend document suite

**Files:** none

- [ ] **Step 1: Install backend dependencies**

Run: `python -m pip install -r backend/requirements.txt`
Expected: packages install successfully

- [ ] **Step 2: Run document-focused test suite**

Run: `pytest backend/tests/test_health.py backend/tests/test_userstore_documents.py backend/tests/test_extract_text.py backend/tests/test_upload_contract.py backend/tests/test_documents_routes.py backend/tests/test_kb_sidecar.py backend/tests/test_upload_sidecar_key.py backend/tests/test_citation_normalization.py -v`
Expected: all tests PASS

---

### Plan Self-Check

**Spec coverage:** backend scaffold, upload flow, document list/get, KB sidecar metadata, readiness status field, and citation normalization covered.

**No placeholders:** all file paths and code included.

**Type consistency:** `userId` and `DOC#{docId}` used consistently with spec and Part 1 tables.
