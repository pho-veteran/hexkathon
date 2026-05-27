# Part 6: Verification and Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify contract alignment, DynamoDB access patterns, auth behavior, full end-to-end flow, and Docker Compose local run path.

**Architecture:** Verification combines automated backend/frontend checks with manual golden-path validation using Docker Compose and AWS-managed services. Final checks emphasize no-scan DynamoDB behavior and trainer demo reproducibility.

**Tech Stack:** pytest, npm build, Docker Compose, curl, browser/manual verification, Terraform outputs, AWS CLI (optional)

---

### Task 6.1: Verify Docker Compose local run path

**Files:** none

- [ ] **Step 1: Create local env file from template**

Run: `cp .env.example .env`
Expected: `.env` exists locally before Docker Compose reads it

- [ ] **Step 2: Bring up containers**

Run: `docker compose up --build -d`
Expected: `backend` and `frontend` containers start successfully

- [ ] **Step 3: Check frontend container logs**

Run: `docker compose logs frontend --tail=50`
Expected: Vite dev server listening on `0.0.0.0:5173`

- [ ] **Step 4: Check backend container logs**

Run: `docker compose logs backend --tail=50`
Expected: Uvicorn server listening on `0.0.0.0:8000`

- [ ] **Step 5: Check health endpoint**

Run: `curl http://localhost:8000/health`
Expected: JSON with `status: ok` and backend summary

---

### Task 6.2: Verify backend automated tests

**Files:** none

- [ ] **Step 1: Run backend test suite**

Run: `pytest backend/tests -v`
Expected: all tests PASS

- [ ] **Step 2: Confirm no failing quiz or battle tests**

Run: `pytest backend/tests -v -k "quiz or battle"`
Expected: PASS

- [ ] **Step 3: Confirm no failing chat or flashcard tests**

Run: `pytest backend/tests -v -k "chat or flashcard"`
Expected: PASS

---

### Task 6.3: Verify frontend build

**Files:** none

- [ ] **Step 1: Run frontend build**

Run: `cd frontend && npm run build`
Expected: production build succeeds

---

### Task 6.4: Verify DynamoDB access patterns by code inspection tests

**Files:**
- Create: `backend/tests/test_dynamodb_access_patterns.py`

- [ ] **Step 1: Write access pattern tests**

```python
# backend/tests/test_dynamodb_access_patterns.py
from src.adapters.userstore import DocumentsStore, ChatMessagesStore, FlashcardSetsStore, QuizzesStore, BattleSessionsStore


def test_documents_store_uses_query_path_not_scan(monkeypatch):
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = DocumentsStore.__new__(DocumentsStore)
    store.table = FakeTable()

    store.list_documents("user-1")

    assert calls[0][0] == "query"
    assert "begins_with(sk, :prefix)" == calls[0][1]["KeyConditionExpression"]


def test_chat_store_uses_query_path_not_scan(monkeypatch):
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ChatMessagesStore.__new__(ChatMessagesStore)
    store.table = FakeTable()

    store.list_messages("user-1")

    assert calls[0][0] == "query"


def test_quizzes_store_uses_get_item_for_exact_lookup(monkeypatch):
    calls = []

    class FakeTable:
        def get_item(self, **kwargs):
            calls.append(("get_item", kwargs))
            return {"Item": None}

    store = QuizzesStore.__new__(QuizzesStore)
    store.table = FakeTable()

    store.get_quiz("user-1", "quiz-1")

    assert calls[0][0] == "get_item"
    assert calls[0][1]["Key"] == {"userId": "user-1", "sk": "QUIZ#quiz-1"}
```

- [ ] **Step 2: Run access pattern tests**

Run: `pytest backend/tests/test_dynamodb_access_patterns.py -v`
Expected: PASS

---

### Task 6.5: Verify auth failure paths

**Files:** none

- [ ] **Step 1: Verify unauthenticated documents route fails**

Run: `curl -i http://localhost:8000/documents`
Expected: `HTTP/1.1 401 Unauthorized`

- [ ] **Step 2: Verify unauthenticated chat route fails**

Run: `curl -i -X POST http://localhost:8000/chat/messages -H "Content-Type: application/json" -d '{"question":"hello","docIds":[]}'`
Expected: `HTTP/1.1 401 Unauthorized`

---

### Task 6.6: Manual golden-path verification

**Files:** none

- [ ] **Step 1: Sign in with Cognito Hosted UI**

Open: `http://localhost:5173`
Expected: Auth gate with sign-in button
Action: Click sign-in, authenticate with demo trainer account
Expected after redirect: Workspace loads

- [ ] **Step 2: Upload a real document**

Action: Upload sample PDF
Expected: document appears in list with `processing`, then `ready`

- [ ] **Step 3: Ask grounded question and inspect citation modal**

Action: Select uploaded doc, ask a content-specific question
Expected: AI answer appears with citation chip(s)
Action: click a citation chip
Expected: modal opens with filename, locator, excerpt

- [ ] **Step 4: Refresh to verify chat history persistence**

Action: browser refresh
Expected: prior messages reload from backend

- [ ] **Step 5: Generate flashcards from selected docs**

Action: select doc(s), generate flashcards
Expected: flashcard set appears and cards render

- [ ] **Step 6: Generate quiz exam from selected docs**

Action: click generate quiz
Expected: saved exam appears in exam list with title/source docs

- [ ] **Step 7: Start battle from saved exam**

Action: click play on saved exam
Expected: battle screen loads chosen quiz, not hardcoded questions

- [ ] **Step 8: Answer question and verify persisted battle state**

Action: answer at least one question
Expected: HP/progress updates and backend response drives next state
Action: refresh or return/resume
Expected: battle can resume with persisted state

---

### Task 6.7: Final regression smoke

**Files:** none

- [ ] **Step 1: Backend health remains green after golden path**

Run: `curl http://localhost:8000/health`
Expected: `status: ok`

- [ ] **Step 2: Frontend rebuild still passes**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 3: Tear down containers**

Run: `docker compose down`
Expected: frontend and backend containers stop cleanly

---

### Plan Self-Check

**Spec coverage:** Docker Compose-only local path, auth checks, citation modal behavior, chat history persistence, flashcard generation, quiz generation, battle resume, DynamoDB no-scan rule, and golden-path trainer demo all covered.

**No placeholders:** all verification commands and expected results are concrete.

**Type consistency:** endpoints and resource names match Parts 2-5.
