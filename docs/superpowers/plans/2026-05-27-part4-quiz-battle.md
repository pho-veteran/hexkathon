# Part 4: Quiz and Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build quiz generation, quizzes persistence, battle session start/resume, answer validation, and battle state transitions.

**Architecture:** Reuse document retrieval and Bedrock invocation to create strict 10-question quiz exams. Persist quizzes and battle sessions in DynamoDB, and keep answer validation and state mutation entirely server-side.

**Tech Stack:** FastAPI, boto3, DynamoDB, Bedrock Runtime, pytest

---

### Task 4.1: Implement quiz prompt and parsing helpers

**Files:**
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_quiz_schema.py`

- [ ] **Step 1: Write failing quiz schema test**

```python
# backend/tests/test_quiz_schema.py
from src.handlers import build_quiz_prompt, parse_quiz_response


def test_build_quiz_prompt_requires_ten_questions():
    prompt = build_quiz_prompt("Some context", ["doc-a", "doc-b"])
    assert "exactly 10" in prompt
    assert "choices" in prompt
    assert "bossPersona" in prompt


def test_parse_quiz_response_returns_questions_array():
    raw = '''{
      "title": "Exam 1",
      "bossPersona": {"name": "Boss", "tone": "grim", "introLine": "Fight."},
      "questions": [
        {
          "questionId": "q1",
          "difficulty": "easy",
          "prompt": "Question?",
          "choices": [
            {"choiceId": "A", "label": "One"},
            {"choiceId": "B", "label": "Two"}
          ],
          "correctChoiceId": "A",
          "bossAskLine": "Choose.",
          "bossCorrectLine": "Good.",
          "bossWrongLine": "Wrong.",
          "source": "page 1"
        }
      ]
    }'''
    parsed = parse_quiz_response(raw, ["doc-a"])
    assert parsed["title"] == "Exam 1"
    assert parsed["questions"][0]["correctChoiceId"] == "A"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_quiz_schema.py -v`
Expected: FAIL

- [ ] **Step 3: Implement helpers**

```python
# backend/src/handlers.py

def build_quiz_prompt(context: str, doc_ids: list[str]) -> str:
    return (
        "Generate exactly 10 grounded multiple-choice questions from the provided context. "
        f"Base documents: {json.dumps(doc_ids)}.\n\n"
        "Respond with JSON only using this schema:\n"
        '{"title":"Exam title","bossPersona":{"name":"name","tone":"tone","introLine":"intro"},'
        '"questions":[{"questionId":"q1","difficulty":"easy|medium|hard","prompt":"...",'
        '"choices":[{"choiceId":"A","label":"..."},{"choiceId":"B","label":"..."},'
        '{"choiceId":"C","label":"..."},{"choiceId":"D","label":"..."}],'
        '"correctChoiceId":"A","bossAskLine":"...","bossCorrectLine":"...",'
        '"bossWrongLine":"...","source":"page/chunk"}]}'
        f"\n\nContext:\n{context}"
    )


def parse_quiz_response(raw: str, doc_ids: list[str]) -> dict:
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        return {"title": "Generated Exam", "docIds": doc_ids, "bossPersona": {}, "questions": []}
    try:
        parsed = json.loads(json_match.group())
    except (json.JSONDecodeError, TypeError):
        return {"title": "Generated Exam", "docIds": doc_ids, "bossPersona": {}, "questions": []}

    return {
        "title": parsed.get("title", "Generated Exam"),
        "docIds": doc_ids,
        "bossPersona": parsed.get("bossPersona", {}),
        "questions": parsed.get("questions", []),
    }
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_quiz_schema.py -v`
Expected: PASS

---

### Task 4.2: Implement quizzes DynamoDB store

**Files:**
- Modify: `backend/src/adapters/userstore.py`
- Create: `backend/tests/test_quizzes_store.py`

- [ ] **Step 1: Write failing quizzes store test**

```python
# backend/tests/test_quizzes_store.py
from src.handlers import build_quiz_item


def test_build_quiz_item_uses_user_partition_and_quiz_sort_key():
    item = build_quiz_item(
        user_id="user-1",
        quiz_id="quiz-1",
        title="Exam 1",
        doc_ids=["doc-1"],
        boss_persona={"name": "Boss"},
        questions=[{"questionId": "q1"}],
        created_at="2026-05-27T00:00:00Z",
    )
    assert item["userId"] == "user-1"
    assert item["sk"] == "QUIZ#quiz-1"
    assert item["quizId"] == "quiz-1"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_quizzes_store.py -v`
Expected: FAIL

- [ ] **Step 3: Implement item helper and store class**

```python
# backend/src/handlers.py

def build_quiz_item(
    user_id: str,
    quiz_id: str,
    title: str,
    doc_ids: list[str],
    boss_persona: dict,
    questions: list[dict],
    created_at: str,
) -> dict:
    return {
        "userId": user_id,
        "sk": f"QUIZ#{quiz_id}",
        "quizId": quiz_id,
        "title": title,
        "docIds": doc_ids,
        "bossPersona": boss_persona,
        "questions": questions,
        "createdAt": created_at,
    }
```

```python
# backend/src/adapters/userstore.py


class QuizzesStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_quiz(self, item: dict) -> None:
        self.table.put_item(Item=item)

    def list_quizzes(self, user_id: str) -> list[dict]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "QUIZ#"},
        )
        return response.get("Items", [])

    def get_quiz(self, user_id: str, quiz_id: str) -> dict | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"QUIZ#{quiz_id}"})
        return response.get("Item")
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_quizzes_store.py -v`
Expected: PASS

---

### Task 4.3: Implement battle session state model

**Files:**
- Modify: `backend/src/handlers.py`
- Create: `backend/tests/test_battle_state.py`

- [ ] **Step 1: Write failing battle state tests**

```python
# backend/tests/test_battle_state.py
from src.handlers import start_battle_session, apply_answer


def test_start_battle_session_initializes_hp_and_index():
    session = start_battle_session(user_id="user-1", session_id="s1", quiz={"quizId": "q1", "questions": [{"questionId": "q1"}]})
    assert session["bossHp"] == 100
    assert session["userHp"] == 100
    assert session["currentQuestionIndex"] == 0
    assert session["status"] == "active"


def test_apply_answer_reduces_boss_hp_on_correct_answer():
    quiz = {
        "quizId": "q1",
        "questions": [{"questionId": "q1", "correctChoiceId": "A", "bossCorrectLine": "Yes.", "bossWrongLine": "No."}]
    }
    session = start_battle_session(user_id="user-1", session_id="s1", quiz=quiz)
    updated = apply_answer(session, quiz, question_id="q1", selected_choice_id="A")
    assert updated["bossHp"] == 90
    assert updated["userHp"] == 100
    assert updated["answerHistory"][0]["isCorrect"] is True
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_battle_state.py -v`
Expected: FAIL

- [ ] **Step 3: Implement battle helpers**

```python
# backend/src/handlers.py

def start_battle_session(user_id: str, session_id: str, quiz: dict) -> dict:
    return {
        "userId": user_id,
        "sk": f"BATTLE#{session_id}",
        "sessionId": session_id,
        "quizId": quiz["quizId"],
        "bossHp": 100,
        "userHp": 100,
        "currentQuestionIndex": 0,
        "answerHistory": [],
        "status": "active",
        "startedAt": utc_now(),
        "updatedAt": utc_now(),
    }


def apply_answer(session: dict, quiz: dict, question_id: str, selected_choice_id: str) -> dict:
    idx = session["currentQuestionIndex"]
    question = quiz["questions"][idx]
    is_correct = question["questionId"] == question_id and question["correctChoiceId"] == selected_choice_id

    updated = dict(session)
    updated["answerHistory"] = list(session["answerHistory"]) + [{
        "questionId": question_id,
        "selectedChoiceId": selected_choice_id,
        "correctChoiceId": question["correctChoiceId"],
        "isCorrect": is_correct,
    }]

    if is_correct:
        updated["bossHp"] = max(0, session["bossHp"] - 10)
        narration = question["bossCorrectLine"]
    else:
        updated["userHp"] = max(0, session["userHp"] - 20)
        narration = question["bossWrongLine"]

    updated["currentQuestionIndex"] = min(idx + 1, len(quiz["questions"]))
    updated["updatedAt"] = utc_now()

    if updated["bossHp"] == 0:
        updated["status"] = "won"
    elif updated["userHp"] == 0:
        updated["status"] = "lost"
    elif updated["currentQuestionIndex"] >= len(quiz["questions"]):
        updated["status"] = "completed"
    else:
        updated["status"] = "active"

    updated["lastNarration"] = narration
    return updated
```

- [ ] **Step 4: Run passing test**

Run: `pytest backend/tests/test_battle_state.py -v`
Expected: PASS

---

### Task 4.4: Implement battle sessions store

**Files:**
- Modify: `backend/src/adapters/userstore.py`
- Create: `backend/tests/test_battle_sessions_store.py`

- [ ] **Step 1: Write failing store test**

```python
# backend/tests/test_battle_sessions_store.py
from src.handlers import start_battle_session


def test_start_battle_session_builds_battle_sort_key():
    session = start_battle_session(
        user_id="user-1",
        session_id="s1",
        quiz={"quizId": "q1", "questions": [{"questionId": "q1"}]},
    )
    assert session["sk"] == "BATTLE#s1"
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_battle_sessions_store.py -v`
Expected: FAIL if previous task not implemented; else PASS and continue to Step 3.

- [ ] **Step 3: Implement store class**

```python
# backend/src/adapters/userstore.py


class BattleSessionsStore:
    table_name: str
    region: str

    def __post_init__(self) -> None:
        self.table = boto3.resource("dynamodb", region_name=self.region).Table(self.table_name)

    def put_session(self, item: dict) -> None:
        self.table.put_item(Item=item)

    def get_session(self, user_id: str, session_id: str) -> dict | None:
        response = self.table.get_item(Key={"userId": user_id, "sk": f"BATTLE#{session_id}"})
        return response.get("Item")

    def list_sessions(self, user_id: str) -> list[dict]:
        response = self.table.query(
            KeyConditionExpression="userId = :user_id AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={":user_id": user_id, ":prefix": "BATTLE#"},
        )
        return response.get("Items", [])
```

- [ ] **Step 4: Run test**

Run: `pytest backend/tests/test_battle_sessions_store.py -v`
Expected: PASS

---

### Task 4.5: Implement quiz generation API

**Files:**
- Modify: `backend/src/app.py`
- Modify: `backend/src/adapters/factory.py`
- Create: `backend/tests/test_quiz_routes.py`

- [ ] **Step 1: Write failing route test**

```python
# backend/tests/test_quiz_routes.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_quiz_routes_require_authentication():
    response = client.get("/quizzes")
    assert response.status_code == 401

    response = client.post("/quizzes/generate", json={"docIds": ["doc-1"]})
    assert response.status_code == 401
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_quiz_routes.py -v`
Expected: FAIL

- [ ] **Step 3: Implement routes**

```python
# backend/src/app.py
from src.adapters.userstore import QuizzesStore, BattleSessionsStore


class QuizGenerateRequest(BaseModel):
    docIds: list[str]


quizzes_store = QuizzesStore(config.quizzes_table, config.aws_region)
battle_sessions_store = BattleSessionsStore(config.battle_sessions_table, config.aws_region)


@app.post("/quizzes/generate")
def generate_quiz(req: QuizGenerateRequest, user_id: str = Depends(get_current_user_id)) -> dict:
    from src.handlers import build_quiz_item, build_quiz_prompt, parse_quiz_response
    from uuid import uuid4

    chunks = retriever.retrieve(
        query="generate 10-question exam from document",
        user_id=user_id,
        doc_ids=req.docIds,
        top_k=20,
    )
    context = "\n\n".join(chunk["text"] for chunk in chunks)
    prompt = build_quiz_prompt(context, req.docIds)
    raw_response = ai_client.invoke(prompt, max_tokens=4096)
    parsed = parse_quiz_response(raw_response, req.docIds)

    quiz_id = str(uuid4())
    item = build_quiz_item(
        user_id=user_id,
        quiz_id=quiz_id,
        title=parsed["title"],
        doc_ids=req.docIds,
        boss_persona=parsed["bossPersona"],
        questions=parsed["questions"],
        created_at=utc_now(),
    )
    quizzes_store.put_quiz(item)
    return item


@app.get("/quizzes")
def list_quizzes(user_id: str = Depends(get_current_user_id)) -> dict:
    return {"quizzes": quizzes_store.list_quizzes(user_id)}


@app.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    quiz = quizzes_store.get_quiz(user_id, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz
```

- [ ] **Step 4: Run passing tests**

Run: `pytest backend/tests/test_quiz_routes.py -v`
Expected: PASS

---

### Task 4.6: Implement battle session routes

**Files:**
- Modify: `backend/src/app.py`
- Create: `backend/tests/test_battle_routes.py`

- [ ] **Step 1: Write failing route test**

```python
# backend/tests/test_battle_routes.py
from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_battle_routes_require_authentication():
    response = client.post("/battle-sessions/start", json={"quizId": "q1"})
    assert response.status_code == 401

    response = client.post("/battle-sessions/s1/answers", json={"questionId": "q1", "selectedChoiceId": "A"})
    assert response.status_code == 401
```

- [ ] **Step 2: Run failing test**

Run: `pytest backend/tests/test_battle_routes.py -v`
Expected: FAIL

- [ ] **Step 3: Implement routes**

```python
# backend/src/app.py


class BattleStartRequest(BaseModel):
    quizId: str


class BattleAnswerRequest(BaseModel):
    questionId: str
    selectedChoiceId: str


@app.post("/battle-sessions/start")
def start_battle(req: BattleStartRequest, user_id: str = Depends(get_current_user_id)) -> dict:
    from src.handlers import start_battle_session
    from uuid import uuid4

    quiz = quizzes_store.get_quiz(user_id, req.quizId)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    session = start_battle_session(user_id, str(uuid4()), quiz)
    battle_sessions_store.put_session(session)
    return {"session": session, "quiz": quiz}


@app.get("/battle-sessions/{session_id}")
def get_battle_session(session_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    session = battle_sessions_store.get_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Battle session not found")

    quiz = quizzes_store.get_quiz(user_id, session["quizId"])
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return {"session": session, "quiz": quiz}


@app.post("/battle-sessions/{session_id}/answers")
def answer_battle_question(
    session_id: str,
    req: BattleAnswerRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    from src.handlers import apply_answer

    session = battle_sessions_store.get_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Battle session not found")

    quiz = quizzes_store.get_quiz(user_id, session["quizId"])
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    updated = apply_answer(session, quiz, req.questionId, req.selectedChoiceId)
    battle_sessions_store.put_session(updated)
    return {"session": updated, "quiz": quiz}
```

- [ ] **Step 4: Run passing tests**

Run: `pytest backend/tests/test_battle_routes.py -v`
Expected: PASS

---

### Task 4.7: Run quiz + battle suite

**Files:** none

- [ ] **Step 1: Run quiz and battle tests**

Run: `pytest backend/tests/test_quiz_schema.py backend/tests/test_quizzes_store.py backend/tests/test_battle_state.py backend/tests/test_battle_sessions_store.py backend/tests/test_quiz_routes.py backend/tests/test_battle_routes.py -v`
Expected: all tests PASS

---

### Plan Self-Check

**Spec coverage:** Quiz exam generation (section 5.5), saved quizzes (section 6 exam list), battle session persistence and answer validation (section 5.6), backend owns quiz correctness and state transitions (section 4 backend responsibilities), strict JSON schema (section 5.5 step 4), 10-question rule enforced in prompt (section 5.5 final note).

**No placeholders:** code and route shapes fully specified.

**Type consistency:** `QUIZ#` and `BATTLE#` match spec and Part 1/Part 2 conventions.
