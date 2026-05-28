from fastapi.testclient import TestClient
from src.app import create_app, get_ai_client, get_current_user_id, get_flashcard_sets_store, get_quizzes_store, get_retriever


class FakeRetriever:
    def __init__(self) -> None:
        self.calls = []

    def retrieve(self, query: str, user_id: str, doc_ids: list[str], top_k: int = 20) -> list[dict]:
        self.calls.append(
            {"query": query, "user_id": user_id, "doc_ids": doc_ids, "top_k": top_k}
        )
        return [{"text": "Doc chunk for quiz generation."}]


class FakeAiClient:
    def invoke(self, prompt: str, max_tokens: int = 4096) -> str:
        return """{
            "title": "Boss Battle Quiz",
            "bossPersona": {"name": "Hydra"},
            "questions": [
                {
                    "questionId": "q-1",
                    "prompt": "What is 2 + 2?",
                    "choices": [
                        {"choiceId": "A", "text": "4"},
                        {"choiceId": "B", "text": "5"}
                    ],
                    "correctChoiceId": "A",
                    "bossCorrectLine": "Correct.",
                    "bossWrongLine": "Wrong."
                }
            ]
        }"""


class FakeQuizzesStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_quiz(self, item: dict) -> None:
        self.items[(item["userId"], item["quizId"])] = item

    def list_quizzes(self, user_id: str) -> list[dict]:
        return [item for (stored_user_id, _), item in self.items.items() if stored_user_id == user_id]

    def get_quiz(self, user_id: str, quiz_id: str) -> dict | None:
        return self.items.get((user_id, quiz_id))


class FakeFlashcardSetsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_set(self, item: dict) -> None:
        self.items[(item["userId"], item["setId"])] = item

    def list_sets(self, user_id: str) -> list[dict]:
        return [item for (stored_user_id, _), item in self.items.items() if stored_user_id == user_id]


client = TestClient(create_app())


def test_quiz_routes_require_authentication():
    response = client.get("/quizzes")
    assert response.status_code == 401

    response = client.post("/quizzes/generate", json={"docIds": ["doc-1"]})
    assert response.status_code == 401


def test_generate_quiz_persists_generated_quiz_id_and_payload_shape():
    app = create_app()
    retriever = FakeRetriever()
    quizzes_store = FakeQuizzesStore()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient()
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    local_client = TestClient(app)

    response = local_client.post("/quizzes/generate", json={"docIds": ["doc-1"]})

    assert response.status_code == 200
    body = response.json()
    assert body["quizId"] != "generated"
    assert body["sk"] == f"QUIZ#{body['quizId']}"
    assert body["userId"] == "user-123"
    assert body["docIds"] == ["doc-1"]
    assert body["bossPersona"] == {"name": "Hydra"}
    assert body["questions"][0]["questionId"] == "q-1"
    assert quizzes_store.get_quiz("user-123", body["quizId"]) == body
    assert retriever.calls == [
        {
            "query": "generate 10-question exam from document",
            "user_id": "user-123",
            "doc_ids": ["doc-1"],
            "top_k": 20,
        }
    ]


def test_list_quizzes_returns_authenticated_users_quizzes():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    quizzes_store.put_quiz(
        {
            "userId": "user-123",
            "sk": "QUIZ#quiz-1",
            "quizId": "quiz-1",
            "title": "Quiz 1",
            "docIds": ["doc-1"],
            "bossPersona": {"name": "Hydra"},
            "questions": [],
            "createdAt": "2026-05-27T00:00:00Z",
        }
    )
    quizzes_store.put_quiz(
        {
            "userId": "other-user",
            "sk": "QUIZ#quiz-2",
            "quizId": "quiz-2",
            "title": "Quiz 2",
            "docIds": ["doc-2"],
            "bossPersona": {"name": "Kraken"},
            "questions": [],
            "createdAt": "2026-05-27T00:00:00Z",
        }
    )
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    local_client = TestClient(app)

    response = local_client.get("/quizzes")

    assert response.status_code == 200
    assert response.json() == {"quizzes": [quizzes_store.get_quiz("user-123", "quiz-1")]}


def test_get_quiz_returns_authenticated_users_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    quiz = {
        "userId": "user-123",
        "sk": "QUIZ#quiz-9",
        "quizId": "quiz-9",
        "title": "Quiz 9",
        "docIds": ["doc-9"],
        "bossPersona": {"name": "Hydra"},
        "questions": [],
        "createdAt": "2026-05-27T00:00:00Z",
    }
    quizzes_store.put_quiz(quiz)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    local_client = TestClient(app)

    response = local_client.get("/quizzes/quiz-9")

    assert response.status_code == 200
    assert response.json() == quiz


def test_generate_flashcards_persists_unique_set_ids():
    class FakeRetriever:
        def retrieve(self, query: str, user_id: str, doc_ids: list[str], top_k: int = 20) -> list[dict]:
            return [{"text": "Doc chunk for flashcards."}]

    class FakeAiClient:
        def invoke(self, prompt: str, max_tokens: int = 2048) -> str:
            return '{"cards": [{"id":"1","front":"Q1","back":"A1","source":"page 1"}]}'

    app = create_app()
    flashcard_sets_store = FakeFlashcardSetsStore()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever()
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient()
    app.dependency_overrides[get_flashcard_sets_store] = lambda: flashcard_sets_store
    local_client = TestClient(app)

    first = local_client.post("/flashcards/generate", json={"docIds": ["doc-1"], "cardCount": 2})
    second = local_client.post("/flashcards/generate", json={"docIds": ["doc-2"], "cardCount": 2})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["setId"] != second.json()["setId"]
    assert first.json()["sk"] != second.json()["sk"]
    assert len(flashcard_sets_store.list_sets("user-123")) == 2
    assert {item["docIds"][0] for item in flashcard_sets_store.list_sets("user-123")} == {"doc-1", "doc-2"}
