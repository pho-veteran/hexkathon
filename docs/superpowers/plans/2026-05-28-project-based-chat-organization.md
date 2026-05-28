# Project-Based Chat Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-scoped chat threads and project-scoped content isolation across documents, flashcards, quizzes, and battle sessions, then verify it through Docker Compose locally and on live AWS.

**Architecture:** Keep the existing split frontend/backend shape. Extend the FastAPI backend with first-class project and chat-thread resources, reshape DynamoDB access patterns to query by user+project, and add a frontend project context that drives a single chat-thread sidebar and project-scoped data hooks.

**Tech Stack:** React 19 + Vite frontend, FastAPI backend, DynamoDB/S3/Bedrock/Cognito on AWS, Docker Compose for all local dev/test, pytest for backend tests.

---

## Accelerated execution strategy

After Task 2, switch from strict task-by-task verification to batched implementation, then batched verification.

### Batch A — backend feature slice
Combine original Tasks 3, 4, and 5 into one implementation pass:
- project-scoped chat threads/messages
- project-aware documents/flashcards/quizzes/battles
- cascade delete for project-owned resources

Why these belong together:
- they all reshape backend resource ownership around `projectId`
- they touch the same route/store/handler surfaces
- verifying them separately causes churn because each step changes the same contracts

### Batch B — platform wiring
Fold original Task 6 into the backend slice before broad verification:
- explicit config for `PROJECTS_TABLE` and `CHAT_THREADS_TABLE`
- Docker Compose env wiring
- Terraform table/output updates

Why now:
- backend implementation should target final config/table names once
- avoids reworking factories/config after feature code lands

### Batch C — frontend feature slice
Combine original Tasks 7, 8, and 9 into one implementation pass:
- project context + zero-project gate
- project dropdown + single chat-thread sidebar
- project-aware hooks + reset-on-switch behavior

Why these belong together:
- they share the same state model (`projects`, `activeProjectId`, `activeThreadId`)
- the UI shell is incomplete without the hooks, and the hooks are hard to validate without the shell

### Batch D — verification only after implementation batches land
Run original Tasks 10 and 11 only after Batches A-C are complete:
- full backend Compose suite
- full frontend Compose build
- local manual Compose verification
- fresh AWS deploy
- live E2E verification

### Updated execution order
1. Completed: backend store contracts
2. Completed: project CRUD API
3. Batch A+B: backend project-scoped resources + cascade delete + config/Compose/Terraform wiring
4. Batch C: frontend project experience end-to-end
5. Batch D: local Compose verification, then AWS deploy and live E2E

### Updated review strategy
- light targeted checks inside each batch to keep repo runnable
- full QA only after each batch completes
- strongest verification reserved for Batch D

## File map

### Backend files to modify
- `backend/src/app.py` — add project/thread request models and routes; require `projectId` on project-scoped endpoints
- `backend/src/handlers.py` — add project/thread item builders and cascade helpers; extend existing item builders with `projectId`
- `backend/src/adapters/userstore.py` — add `ProjectsStore`, `ChatThreadsStore`; extend existing stores with project-aware queries and exact lookups
- `backend/src/adapters/factory.py` — wire new stores
- `backend/src/config.py` — add table names for projects and chat threads if missing
- `backend/terraform/dynamodb.tf` — add tables for projects and chat threads; update existing tables for fresh deploy naming/shape if needed
- `docker-compose.yml` — add env vars for new table names across backend/backend-tests services

### Backend tests to modify/create
- `backend/tests/test_chat_routes.py` — replace flat message assumptions with thread route auth coverage
- `backend/tests/test_dynamodb_access_patterns.py` — assert query/get-item paths for project/thread stores and project-aware content stores
- `backend/tests/test_documents_routes.py` — extend auth+project route expectations
- `backend/tests/test_quiz_routes.py` — add `projectId` expectations
- `backend/tests/test_battle_routes.py` — add `projectId` expectations
- `backend/tests/test_chat_messages_store.py` — update for project/thread-aware message key shape
- `backend/tests/test_battle_sessions_store.py` — update for project-aware lookup shape
- Create: `backend/tests/test_projects_routes.py`
- Create: `backend/tests/test_projects_store.py`
- Create: `backend/tests/test_chat_threads_store.py`
- Create: `backend/tests/test_project_cascade.py`

### Frontend files to modify
- `frontend/src/App.jsx` — gate workspace on project availability, hold active project/thread UI routing state where needed
- `frontend/src/components/Workspace.jsx` — add project dropdown, left chat-thread sidebar, active-thread chat pane, project reset behavior
- `frontend/src/components/DocumentLibrary.jsx` — make project-aware via hook input
- `frontend/src/components/ExamListView.jsx` — make project-aware empty/loading behavior stable during switch
- `frontend/src/components/BattleCard.jsx` — scope battle session restore/start by active project
- `frontend/src/hooks/useChat.js` — split into thread list + thread messages + send message under project/thread
- `frontend/src/hooks/useDocuments.js` — require `projectId`
- `frontend/src/hooks/useFlashcards.js` — require `projectId`
- `frontend/src/hooks/useQuizzes.js` — require `projectId`
- `frontend/src/hooks/useBattle.js` — require `projectId` on start/resume/answer if current implementation does not already
- `frontend/src/context/AuthContext.jsx` — keep auth only unless bootstrap user/project info proves simpler there

### Frontend files to create
- `frontend/src/context/ProjectContext.jsx` — load/manage projects, active project, create/rename/delete/switch actions
- `frontend/src/components/ProjectSwitcher.jsx` — dropdown UI for create/rename/delete/switch
- `frontend/src/components/ChatThreadSidebar.jsx` — single left sidebar listing threads for active project
- `frontend/src/components/CreateProjectGate.jsx` — blocking zero-project state

### Local verification files to modify
- `frontend/README.md` or root README only if needed to keep Compose-only flow explicit

---

### Task 1: Add backend store contracts for projects and project-aware resources

**Files:**
- Modify: `backend/src/adapters/userstore.py`
- Modify: `backend/src/handlers.py`
- Test: `backend/tests/test_projects_store.py`
- Test: `backend/tests/test_chat_threads_store.py`
- Test: `backend/tests/test_chat_messages_store.py`
- Test: `backend/tests/test_dynamodb_access_patterns.py`

- [ ] **Step 1: Write failing store tests for projects and chat threads**

```python
from src.adapters.userstore import ProjectsStore, ChatThreadsStore


def test_projects_store_lists_projects_by_user_without_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ProjectsStore.__new__(ProjectsStore)
    store.table = FakeTable()

    store.list_projects("user-1")

    assert calls[0][0] == "query"
    assert calls[0][1]["ExpressionAttributeValues"] == {":user_id": "user-1", ":prefix": "PROJECT#"}


def test_chat_threads_store_lists_threads_by_user_and_project_without_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ChatThreadsStore.__new__(ChatThreadsStore)
    store.table = FakeTable()

    store.list_threads("user-1", "project-1")

    assert calls[0][0] == "query"
    assert calls[0][1]["ExpressionAttributeValues"] == {
        ":user_id": "user-1",
        ":prefix": "THREAD#project-1#",
    }
```

- [ ] **Step 2: Run store tests to verify they fail**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_projects_store.py tests/test_chat_threads_store.py tests/test_chat_messages_store.py tests/test_dynamodb_access_patterns.py -v
```

Expected: FAIL with import or attribute errors for `ProjectsStore`, `ChatThreadsStore`, or old message query assumptions.

- [ ] **Step 3: Add minimal store implementations and project-aware item builders**

```python
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
```

```python
def build_project_item(user_id: str, project_id: str, name: str, created_at: str) -> dict:
    return {
        "userId": user_id,
        "sk": f"PROJECT#{project_id}",
        "projectId": project_id,
        "name": name,
        "createdAt": created_at,
        "updatedAt": created_at,
    }


def build_chat_thread_item(user_id: str, project_id: str, thread_id: str, title: str, created_at: str) -> dict:
    return {
        "userId": user_id,
        "sk": f"THREAD#{project_id}#{created_at}#{thread_id}",
        "projectId": project_id,
        "threadId": thread_id,
        "title": title,
        "createdAt": created_at,
        "updatedAt": created_at,
    }


def build_chat_message_item(user_id: str, project_id: str, thread_id: str, message_id: str, role: str, content: str, doc_ids: list[str], created_at: str, citations: list[dict]) -> dict:
    return {
        "userId": user_id,
        "sk": f"CHAT#{project_id}#{thread_id}#{created_at}#{message_id}",
        "projectId": project_id,
        "threadId": thread_id,
        "messageId": message_id,
        "role": role,
        "content": content,
        "docIds": doc_ids,
        "citations": citations,
        "createdAt": created_at,
    }
```

- [ ] **Step 4: Update existing store tests for project-aware chat message keys**

```python
def test_build_chat_message_item_uses_project_and_thread_in_sort_key():
    from src.handlers import build_chat_message_item

    item = build_chat_message_item(
        user_id="user-1",
        project_id="project-1",
        thread_id="thread-1",
        message_id="msg-1",
        role="user",
        content="hello",
        doc_ids=[],
        created_at="2026-05-28T00:00:00Z",
        citations=[],
    )

    assert item["sk"] == "CHAT#project-1#thread-1#2026-05-28T00:00:00Z#msg-1"
```

- [ ] **Step 5: Run store tests to verify they pass**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_projects_store.py tests/test_chat_threads_store.py tests/test_chat_messages_store.py tests/test_dynamodb_access_patterns.py -v
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: add project and chat thread store primitives
```

---

### Task 2: Add backend project CRUD API with validation

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/adapters/factory.py`
- Modify: `backend/src/config.py`
- Test: `backend/tests/test_projects_routes.py`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Write failing route tests for project CRUD auth + validation**

```python
from fastapi.testclient import TestClient
from src.app import create_app

client = TestClient(create_app())


def test_projects_routes_require_authentication():
    assert client.get("/projects").status_code == 401
    assert client.post("/projects", json={"name": "Alpha"}).status_code == 401


def test_create_project_rejects_blank_name(authed_client):
    response = authed_client.post("/projects", json={"name": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Project name is required"
```

- [ ] **Step 2: Run project route tests to verify they fail**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_projects_routes.py -v
```

Expected: FAIL because `/projects` routes and request models do not exist.

- [ ] **Step 3: Add request models, factory wiring, and CRUD endpoints**

```python
class ProjectCreateRequest(BaseModel):
    name: str


class ProjectUpdateRequest(BaseModel):
    name: str


def get_projects_store():
    return make_projects_store()


@app.get("/projects")
def list_projects(user_id: str = Depends(get_current_user_id), projects_store=Depends(get_projects_store)) -> dict:
    return {"projects": projects_store.list_projects(user_id)}


@app.post("/projects")
def create_project(req: ProjectCreateRequest, user_id: str = Depends(get_current_user_id), projects_store=Depends(get_projects_store)) -> dict:
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")
    existing = projects_store.list_projects(user_id)
    if any(project["name"].strip().lower() == name.lower() for project in existing):
        raise HTTPException(status_code=400, detail="Project name already exists")
    item = build_project_item(user_id, str(uuid4()), name, utc_now())
    projects_store.put_project(item)
    return item
```

- [ ] **Step 4: Add rename and delete endpoints with exact ownership lookup**

```python
@app.patch("/projects/{project_id}")
def rename_project(project_id: str, req: ProjectUpdateRequest, user_id: str = Depends(get_current_user_id), projects_store=Depends(get_projects_store)) -> dict:
    project = projects_store.get_project(user_id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required")
    updated = {**project, "name": name, "updatedAt": utc_now()}
    projects_store.put_project(updated)
    return updated
```

```python
@app.delete("/projects/{project_id}")
def delete_project(project_id: str, user_id: str = Depends(get_current_user_id), projects_store=Depends(get_projects_store)) -> dict:
    project = projects_store.get_project(user_id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    projects_store.delete_project(user_id, project_id)
    return {"deleted": True, "projectId": project_id}
```

- [ ] **Step 5: Run project route tests to verify they pass**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_projects_routes.py -v
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: add authenticated project CRUD routes
```

---

### Batch A+B: Backend project-scoped resource implementation + platform wiring

This batch intentionally combines original Tasks 3, 4, 5, and 6. Implement the backend ownership model, cascade behavior, and final config/table wiring in one pass before broad verification.

#### Original Task 3: Refactor backend chat into project-scoped threads and messages

### Task 3: Refactor backend chat into project-scoped threads and messages

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/adapters/userstore.py`
- Modify: `backend/src/adapters/factory.py`
- Modify: `backend/src/handlers.py`
- Test: `backend/tests/test_chat_routes.py`
- Test: `backend/tests/test_chat_threads_store.py`

- [ ] **Step 1: Write failing route tests for thread list/create/message list/send**

```python
def test_thread_routes_require_authentication(client):
    assert client.get("/chat/threads?projectId=project-1").status_code == 401
    assert client.post("/chat/threads", json={"projectId": "project-1", "title": "New Chat"}).status_code == 401


def test_thread_message_routes_require_authentication(client):
    assert client.get("/chat/threads/thread-1/messages?projectId=project-1").status_code == 401
    assert client.post("/chat/threads/thread-1/messages", json={"projectId": "project-1", "question": "hello", "docIds": []}).status_code == 401
```

- [ ] **Step 2: Run chat route tests to verify they fail**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_chat_routes.py -v
```

Expected: FAIL because `/chat/threads` endpoints do not exist.

- [ ] **Step 3: Add thread request models and route handlers**

```python
class ChatThreadCreateRequest(BaseModel):
    projectId: str
    title: str = "New Chat"


class ThreadMessageRequest(BaseModel):
    projectId: str
    question: str
    docIds: list[str] = Field(default_factory=list)


@app.get("/chat/threads")
def list_chat_threads(projectId: str, user_id: str = Depends(get_current_user_id), chat_threads_store=Depends(get_chat_threads_store)) -> dict:
    return {"threads": chat_threads_store.list_threads(user_id, projectId)}
```

```python
@app.post("/chat/threads")
def create_chat_thread(req: ChatThreadCreateRequest, user_id: str = Depends(get_current_user_id), chat_threads_store=Depends(get_chat_threads_store), projects_store=Depends(get_projects_store)) -> dict:
    project = projects_store.get_project(user_id, req.projectId)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    item = build_chat_thread_item(user_id, req.projectId, str(uuid4()), req.title.strip() or "New Chat", utc_now())
    chat_threads_store.put_thread(item)
    return item
```

- [ ] **Step 4: Add thread message list/send routes using retriever + AI path**

```python
@app.get("/chat/threads/{thread_id}/messages")
def list_thread_messages(thread_id: str, projectId: str, user_id: str = Depends(get_current_user_id), chat_threads_store=Depends(get_chat_threads_store), chat_messages_store=Depends(get_chat_messages_store)) -> dict:
    thread = chat_threads_store.get_thread(user_id, projectId, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")
    return {"messages": chat_messages_store.list_messages(user_id, projectId, thread_id)}
```

```python
@app.post("/chat/threads/{thread_id}/messages")
def create_thread_message(thread_id: str, req: ThreadMessageRequest, user_id: str = Depends(get_current_user_id), retriever=Depends(get_retriever), ai_client=Depends(get_ai_client), chat_threads_store=Depends(get_chat_threads_store), chat_messages_store=Depends(get_chat_messages_store)) -> dict:
    thread = chat_threads_store.get_thread(user_id, req.projectId, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Chat thread not found")
    results = retriever.retrieve(query=req.question, user_id=user_id, doc_ids=req.docIds if req.docIds else None)
    citations = [normalize_citation(f"c{i}", result) for i, result in enumerate(results)]
    context = "\n\n".join(result["text"] for result in results)
    answer = ai_client.invoke(ai_client.build_grounded_prompt(req.question, context, citations))
    now = utc_now()
    chat_messages_store.put_message(build_chat_message_item(user_id, req.projectId, thread_id, str(uuid4()), "user", req.question, req.docIds, now, []))
    bot_msg = build_chat_message_item(user_id, req.projectId, thread_id, str(uuid4()), "bot", answer, req.docIds, utc_now(), citations)
    chat_messages_store.put_message(bot_msg)
    return bot_msg
```

- [ ] **Step 5: Run chat route tests to verify they pass**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_chat_routes.py tests/test_chat_threads_store.py -v
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: add project-scoped chat threads and messages
```

---

### Task 4: Make documents, flashcards, quizzes, and battles require `projectId`

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/handlers.py`
- Modify: `backend/src/adapters/userstore.py`
- Test: `backend/tests/test_documents_routes.py`
- Test: `backend/tests/test_quiz_routes.py`
- Test: `backend/tests/test_battle_routes.py`
- Test: `backend/tests/test_flashcard_schema.py`

- [ ] **Step 1: Write failing tests for project-aware routes and stored items**

```python
def test_document_upload_requires_project_id(authed_client):
    response = authed_client.post("/documents/upload", files={"file": ("doc.txt", b"hello", "text/plain")})
    assert response.status_code == 422


def test_quiz_generation_requires_project_id(authed_client):
    response = authed_client.post("/quizzes/generate", json={"docIds": ["doc-1"]})
    assert response.status_code == 422
```

- [ ] **Step 2: Run content route tests to verify they fail**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_documents_routes.py tests/test_quiz_routes.py tests/test_battle_routes.py -v
```

Expected: FAIL because routes currently accept user-wide content without `projectId`.

- [ ] **Step 3: Extend request models and stored item builders with `projectId`**

```python
class FlashcardGenerateRequest(BaseModel):
    projectId: str
    docIds: list[str] = Field(default_factory=list)
    cardCount: int = Field(default=10, ge=1)


class QuizGenerateRequest(BaseModel):
    projectId: str
    docIds: list[str]


class BattleStartRequest(BaseModel):
    projectId: str
    quizId: str
```

```python
def build_document_item(user_id: str, project_id: str, doc_id: str, filename: str, s3_key: str, content_type: str, kb_ingest_status: str, upload_status: str, created_at: str) -> dict[str, Any]:
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
```

- [ ] **Step 4: Update route handlers to validate project ownership before work**

```python
@app.get("/documents")
def list_documents(projectId: str, user_id: str = Depends(get_current_user_id), projects_store=Depends(get_projects_store), documents_store=Depends(get_documents_store)) -> dict:
    if not projects_store.get_project(user_id, projectId):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"documents": documents_store.list_documents(user_id, projectId)}
```

```python
@app.post("/battle-sessions/start")
def start_battle(req: BattleStartRequest, user_id: str = Depends(get_current_user_id), quizzes_store=Depends(get_quizzes_store), battle_sessions_store=Depends(get_battle_sessions_store)) -> dict:
    quiz = quizzes_store.get_quiz(user_id, req.projectId, req.quizId)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    session = start_battle_session(user_id, req.projectId, str(uuid4()), quiz)
    battle_sessions_store.put_session(session)
    return {"session": session, "quiz": quiz}
```

- [ ] **Step 5: Run content route tests to verify they pass**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_documents_routes.py tests/test_quiz_routes.py tests/test_battle_routes.py tests/test_flashcard_schema.py -v
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: scope content and battle APIs to active project
```

---

### Task 5: Add backend cascade delete for project-owned data

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/adapters/userstore.py`
- Modify: `backend/src/adapters/storage.py` if delete support is missing
- Test: `backend/tests/test_project_cascade.py`

- [ ] **Step 1: Write failing cascade-delete test**

```python
def test_delete_project_cascades_owned_resources(project_service):
    result = project_service.delete_project("user-1", "project-1")
    assert result == {"deleted": True, "projectId": "project-1"}
    assert project_service.documents_deleted == ["project-1"]
    assert project_service.threads_deleted == ["project-1"]
    assert project_service.messages_deleted == ["project-1"]
```

- [ ] **Step 2: Run cascade test to verify it fails**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_project_cascade.py -v
```

Expected: FAIL because delete currently removes only the project record or route does not exist yet.

- [ ] **Step 3: Implement minimal cascade orchestration helper**

```python
def delete_project_resources(user_id: str, project_id: str, projects_store, chat_threads_store, chat_messages_store, documents_store, flashcard_sets_store, quizzes_store, battle_sessions_store, storage) -> None:
    documents = documents_store.list_documents(user_id, project_id)
    for document in documents:
        storage.delete_prefix(f"users/{user_id}/docs/{document['docId']}/")
    chat_messages_store.delete_messages_for_project(user_id, project_id)
    chat_threads_store.delete_threads_for_project(user_id, project_id)
    documents_store.delete_documents_for_project(user_id, project_id)
    flashcard_sets_store.delete_sets_for_project(user_id, project_id)
    quizzes_store.delete_quizzes_for_project(user_id, project_id)
    battle_sessions_store.delete_sessions_for_project(user_id, project_id)
    projects_store.delete_project(user_id, project_id)
```

- [ ] **Step 4: Use helper from delete route and keep 404 behavior intact**

```python
@app.delete("/projects/{project_id}")
def delete_project(...):
    project = projects_store.get_project(user_id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    delete_project_resources(...)
    return {"deleted": True, "projectId": project_id}
```

- [ ] **Step 5: Run cascade tests to verify they pass**

Run:
```bash
docker compose run --rm backend-tests pytest tests/test_project_cascade.py tests/test_projects_routes.py -v
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: cascade-delete project-owned resources
```

---

### Task 6: Add Terraform/Compose support for projects and chat threads

**Files:**
- Modify: `backend/src/config.py`
- Modify: `backend/src/adapters/factory.py`
- Modify: `backend/terraform/dynamodb.tf`
- Modify: `backend/terraform/variables.tf`
- Modify: `backend/terraform/outputs.tf` — export new table names plus frontend bucket and CloudFront distribution identifiers for deploy/verification
- Modify: `docker-compose.yml`
- Test: local config boot via Compose

- [ ] **Step 1: Write a config smoke check command that should fail before env vars exist**

Run:
```bash
docker compose run --rm backend-tests python -c "from src.config import config; print(config.projects_table, config.chat_threads_table)"
```

Expected: FAIL with missing config attributes.

- [ ] **Step 2: Add config and factory wiring for new tables**

```python
class Config(BaseSettings):
    projects_table: str = Field(alias="PROJECTS_TABLE")
    chat_threads_table: str = Field(alias="CHAT_THREADS_TABLE")
```

```python
def make_projects_store() -> ProjectsStore:
    return ProjectsStore(config.projects_table, config.aws_region)


def make_chat_threads_store() -> ChatThreadsStore:
    return ChatThreadsStore(config.chat_threads_table, config.aws_region)
```

- [ ] **Step 3: Add Compose env vars for backend and backend-tests**

```yaml
environment:
  PROJECTS_TABLE: ${PROJECTS_TABLE:-projects}
  CHAT_THREADS_TABLE: ${CHAT_THREADS_TABLE:-chat-threads}
```

- [ ] **Step 4: Add fresh-deploy DynamoDB table resources in Terraform**

- [ ] **Step 4.5: Export deploy-critical outputs for frontend publishing**

```hcl
output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}
```

Expected: `terraform output -json` includes `frontend_bucket` and `cloudfront_distribution_id` for the deploy step.

- [ ] **Step 5: Run config smoke check and Compose boot check**

```hcl
resource "aws_dynamodb_table" "projects" {
  name         = var.projects_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}
```

```hcl
resource "aws_dynamodb_table" "chat_threads" {
  name         = var.chat_threads_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "sk"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}
```

- [ ] **Step 5: Run config smoke check and Compose boot check**

Run:
```bash
docker compose run --rm backend-tests python -c "from src.config import config; print(config.projects_table, config.chat_threads_table)"
docker compose config
```

Expected: first command prints default table names; second command exits 0.

- [ ] **Step 6: Suggested commit message only**

```text
chore: wire project and chat thread tables into config and IaC
```

---

### Batch C: Frontend project experience implementation

This batch intentionally combines original Tasks 7, 8, and 9. Build the frontend project experience end-to-end before broad frontend QA.

#### Original Task 7: Add frontend project context and zero-project gate

### Task 7: Add frontend project context and zero-project gate

**Files:**
- Create: `frontend/src/context/ProjectContext.jsx`
- Create: `frontend/src/components/CreateProjectGate.jsx`
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Write minimal failing UI state test plan in code comments or manual harness note**

```jsx
// Expected behavior for manual verification:
// 1. If /projects returns [], render CreateProjectGate.
// 2. Submitting a valid name creates project and enters workspace.
// 3. Switching active project updates context value for consumers.
```

- [ ] **Step 2: Run frontend build to capture current baseline**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS before context changes.

- [ ] **Step 3: Add minimal project context implementation**

```jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/client'

const ProjectContext = createContext(null)

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/projects')
      const next = data.projects || []
      setProjects(next)
      setActiveProjectId((current) => current && next.some((p) => p.projectId === current) ? current : next[0]?.projectId || null)
    } finally {
      setLoading(false)
    }
  }, [])
```

- [ ] **Step 4: Add create-first-project gate and provider wiring**

```jsx
export default function CreateProjectGate() {
  const { createProject, loading } = useProjects()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    try {
      setError(null)
      await createProject(name)
      setName('')
    } catch (err) {
      setError(err.message)
    }
  }
```

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 5: Run frontend build to verify it passes**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: add project context and zero-project workspace gate
```

---

### Task 8: Add frontend project dropdown and single thread sidebar

**Files:**
- Create: `frontend/src/components/ProjectSwitcher.jsx`
- Create: `frontend/src/components/ChatThreadSidebar.jsx`
- Modify: `frontend/src/components/Workspace.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Run current frontend build before shell refactor**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 2: Add project switcher dropdown component**

```jsx
export default function ProjectSwitcher() {
  const { projects, activeProjectId, switchProject, createProject, renameProject, deleteProject } = useProjects()
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Project</label>
      <select value={activeProjectId || ''} onChange={(event) => switchProject(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        {projects.map((project) => (
          <option key={project.projectId} value={project.projectId}>{project.name}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Add chat thread sidebar component**

```jsx
export default function ChatThreadSidebar({ threads, activeThreadId, onSelectThread, onCreateThread, loading }) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Chats</h2>
        <button onClick={onCreateThread} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">New chat</button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {loading ? <p className="px-2 py-3 text-xs text-slate-400">Loading chats...</p> : null}
        {threads.map((thread) => (
          <button key={thread.threadId} onClick={() => onSelectThread(thread.threadId)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${thread.threadId === activeThreadId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}>
            {thread.title}
          </button>
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Refactor `Workspace.jsx` to use one left sidebar and top project control**

```jsx
<div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)_minmax(320px,380px)]">
  <ChatThreadSidebar
    threads={threads}
    activeThreadId={activeThreadId}
    onSelectThread={setActiveThreadId}
    onCreateThread={handleCreateThread}
    loading={threadsLoading}
  />
  <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
    {/* active thread chat pane */}
  </section>
  <aside className="space-y-4">
    <ProjectSwitcher />
    <DocumentLibrary ... />
    <FlashcardList ... />
    <ExamListView ... />
  </aside>
</div>
```

- [ ] **Step 5: Run frontend build to verify shell passes**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: add project switcher and chat thread sidebar UI
```

---

### Task 9: Make frontend hooks project-aware and reset on switch

**Files:**
- Modify: `frontend/src/hooks/useChat.js`
- Modify: `frontend/src/hooks/useDocuments.js`
- Modify: `frontend/src/hooks/useFlashcards.js`
- Modify: `frontend/src/hooks/useQuizzes.js`
- Modify: `frontend/src/hooks/useBattle.js`
- Modify: `frontend/src/components/Workspace.jsx`
- Modify: `frontend/src/components/DocumentLibrary.jsx`
- Modify: `frontend/src/components/BattleCard.jsx`

- [ ] **Step 1: Run frontend build before hook refactor**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 2: Rewrite `useChat` around `projectId` and `threadId`**

```jsx
export function useChat(projectId, threadId) {
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const loadThreads = useCallback(async () => {
    if (!projectId) {
      setThreads([])
      return
    }
    const data = await apiFetch(`/chat/threads?projectId=${encodeURIComponent(projectId)}`)
    setThreads(data.threads || [])
  }, [projectId])
```

```jsx
  const sendMessage = useCallback(async (question, docIds) => {
    if (!projectId || !threadId) {
      throw new Error('Select or create a chat first.')
    }
    setLoading(true)
    try {
      const result = await apiFetch(`/chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, question, docIds }),
      })
      await loadMessages()
      return result
    } finally {
      setLoading(false)
    }
  }, [projectId, threadId, loadMessages])
```

- [ ] **Step 3: Rewrite document/flashcard/quiz hooks to require `projectId`**

```jsx
const data = await apiFetch(`/documents?projectId=${encodeURIComponent(projectId)}`)
```

```jsx
body: JSON.stringify({ projectId, docIds, cardCount })
```

```jsx
body: JSON.stringify({ projectId, docIds })
```

- [ ] **Step 4: Reset UI state on project switch and scope battle restore by project**

```jsx
useEffect(() => {
  setSelectedDocIds([])
  setInputValue('')
  setCitation(null)
  setActionError(null)
}, [activeProjectId])
```

```jsx
const storageKey = quizId && projectId ? `battleSession:${projectId}:${quizId}` : null
```

- [ ] **Step 5: Run frontend build to verify hook refactor passes**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 6: Suggested commit message only**

```text
feat: scope frontend data hooks and battle state to active project
```

---

### Batch D: Verification and deployment

This batch intentionally combines original Tasks 10 and 11. Do not start broad QA until Batches A-C are complete.

#### Original Task 10: Run backend and frontend verification locally through Docker Compose only

### Task 10: Run backend and frontend verification locally through Docker Compose only

**Files:**
- Modify only if fixes are needed from verification

- [ ] **Step 1: Run backend test suite through Compose**

Run:
```bash
docker compose run --rm backend-tests pytest tests -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend production build through Compose**

Run:
```bash
docker compose run --rm frontend npm run build
```

Expected: PASS.

- [ ] **Step 3: Start full local stack through Compose**

Run:
```bash
docker compose up --build backend frontend
```

Expected: backend on `http://localhost:8000`, frontend on `http://localhost:5173`.

- [ ] **Step 4: Manually verify zero-project gate and project creation**

Checklist:
```text
1. Sign in.
2. If account has no projects, create-first-project gate appears.
3. Create project 'Alpha'.
4. Workspace opens with Alpha selected.
```

- [ ] **Step 5: Manually verify project switch isolation**

Checklist:
```text
1. In Alpha, create thread and send message.
2. Upload a document in Alpha.
3. Create project 'Beta'.
4. Switch to Beta.
5. Confirm chats/docs/flashcards/quizzes are empty in Beta.
6. Confirm chat input and selected docs reset on switch.
```

- [ ] **Step 6: Suggested commit message only**

```text
test: verify project-scoped behavior through docker compose locally
```

---

### Task 11: Deploy fresh AWS stack and run live E2E verification

**Files:**
- Modify only if deployment/verification finds defects

- [ ] **Step 1: Re-run Terraform plan/apply for fresh project/thread table shape**

Run:
```bash
terraform -chdir=backend/terraform plan
terraform -chdir=backend/terraform apply
```

Expected: plan shows new/updated table resources for projects and chat threads, then apply succeeds.

- [ ] **Step 2: Build and deploy backend/frontend artifacts with repo-aligned Terraform + S3/CloudFront flow**

Run:
```bash
terraform -chdir=backend/terraform output -json > terraform-outputs.json
cd frontend && npm run build && cd ..
aws s3 sync frontend/dist s3://$(python -c "import json; print(json.load(open('terraform-outputs.json'))['frontend_bucket']['value'])") --delete
aws cloudfront create-invalidation --distribution-id $(python -c "import json; print(json.load(open('terraform-outputs.json'))['cloudfront_distribution_id']['value'])") --paths '/*'
```

Expected: frontend static assets uploaded to the Terraform-managed S3 bucket, CloudFront cache invalidated, and deployed frontend points at the Terraform-managed API/backend resources.

If backend Lambda package is not automatically refreshed by Terraform apply in Step 1, rerun:
```bash
terraform -chdir=backend/terraform apply
```

Expected: Lambda/environment updates converge to the current backend source and table names.

- [ ] **Step 3: Run live E2E in real app**

Checklist:
```text
1. Sign in via Cognito Hosted UI.
2. Create first project.
3. Upload document into project A.
4. Create a chat thread and ask grounded question.
5. Generate flashcards.
6. Generate quiz.
7. Start battle session.
8. Create project B.
9. Switch to B and verify isolation.
10. Switch back to A and verify original data remains.
```

- [ ] **Step 4: Run verification with stronger reviewer model if subagents are used**

```text
Use Opus for final verification/review tasks, not Sonnet.
```

- [ ] **Step 5: Fix any live verification defects and repeat affected checks**

```text
If any step fails, patch the specific issue, rerun the exact failing local Compose test/build first, then rerun the affected live E2E steps.
```

- [ ] **Step 6: Suggested commit message only**

```text
feat: ship project-scoped chat organization across app and AWS deploy
```

---

## Self-review

### Spec coverage
- Project CRUD → Tasks 1, 2, 5, 7, 8
- Single left sidebar for chat threads only → Tasks 8, 9
- Multiple chat threads per project → Tasks 3, 8, 9
- Project-scoped docs/flashcards/quizzes/battles → Tasks 4, 9, 10, 11
- Zero-project gate → Task 7
- Reset input + selected docs on switch → Task 9
- Docker Compose only local dev/test → Tasks 6, 10
- Fresh AWS deploy + live E2E → Task 11
- Prefer subagents/no worktrees/model split → execution note in header + Task 11 step 4

### Placeholder scan
- No `TODO` / `TBD` placeholders left in implementation tasks.
- The only intentionally open line is deployment command selection in Task 11 Step 2; executor must confirm exact existing deploy command from repo docs/env before running because current command path was not read in this planning pass.

### Type consistency
- Consistent names used across plan: `projectId`, `threadId`, `ProjectsStore`, `ChatThreadsStore`, `build_project_item`, `build_chat_thread_item`.
- Frontend state consistently uses `activeProjectId` and `activeThreadId`.
