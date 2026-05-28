from fastapi.testclient import TestClient
from src.app import create_app, get_ai_client, get_current_user_id, get_flashcard_sets_store, get_projects_store, get_quizzes_store, get_retriever


class FakeRetriever:
    def __init__(self) -> None:
        self.calls = []

    def retrieve(self, query: str, user_id: str, doc_ids: list[str], top_k: int = 20) -> list[dict]:
        self.calls.append({"query": query, "user_id": user_id, "doc_ids": doc_ids, "top_k": top_k})
        return [{"text": "Doc chunk for quiz generation."}]


class FakeAiClient:
    def invoke(self, prompt: str, max_tokens: int = 4096) -> str:
        return '{"title":"Boss Battle Quiz","bossPersona":{"name":"Hydra"},"questions":[{"questionId":"q-1","prompt":"What is 2 + 2?","choices":[{"choiceId":"A","text":"4"},{"choiceId":"B","text":"5"}],"correctChoiceId":"A","bossCorrectLine":"Correct.","bossWrongLine":"Wrong."}]}'


class FakeProjectsStore:
    def get_project(self, user_id: str, project_id: str) -> dict | None:
        return {"userId": user_id, "projectId": project_id, "name": "Alpha"}


class FakeQuizzesStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str, str], dict] = {}

    def put_quiz(self, item: dict) -> None:
        self.items[(item["userId"], item["projectId"], item["quizId"])] = item

    def list_quizzes(self, user_id: str, project_id: str) -> list[dict]:
        return [item for (stored_user_id, stored_project_id, _), item in self.items.items() if stored_user_id == user_id and stored_project_id == project_id]

    def get_quiz(self, user_id: str, project_id: str, quiz_id: str) -> dict | None:
        return self.items.get((user_id, project_id, quiz_id))


class FakeFlashcardSetsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_set(self, item: dict) -> None:
        self.items[(item["userId"], item["setId"])] = item

    def list_sets(self, user_id: str, project_id: str) -> list[dict]:
        return [item for (_, _), item in self.items.items() if item["userId"] == user_id and item["projectId"] == project_id]


client = TestClient(create_app())


def test_quiz_routes_require_authentication():
    response = client.get("/quizzes?projectId=project-1")
    assert response.status_code == 401

    response = client.post("/quizzes/generate", json={"projectId": "project-1", "docIds": ["doc-1"]})
    assert response.status_code == 401


def test_quiz_generation_requires_project_id():
    app = create_app()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.post("/quizzes/generate", json={"docIds": ["doc-1"]})

    assert response.status_code == 422
    assert "projectId" in response.text


def test_generate_quiz_persists_generated_quiz_id_and_payload_shape():
    app = create_app()
    retriever = FakeRetriever()
    quizzes_store = FakeQuizzesStore()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_retriever] = lambda: retriever
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient()
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.post("/quizzes/generate", json={"projectId": "project-1", "docIds": ["doc-1"]})

    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] == "project-1"
    assert body["sk"] == f"QUIZ#project-1#{body['quizId']}"
    assert quizzes_store.get_quiz("user-123", "project-1", body["quizId"]) == body


def test_generate_flashcards_persists_unique_set_ids():
    class LocalRetriever:
        def retrieve(self, query: str, user_id: str, doc_ids: list[str], top_k: int = 20) -> list[dict]:
            return [{"text": "Doc chunk for flashcards."}]

    class LocalAiClient:
        def invoke(self, prompt: str, max_tokens: int = 2048) -> str:
            return '{"cards": [{"id":"1","front":"Q1","back":"A1","source":"page 1"}]}'

    app = create_app()
    flashcard_sets_store = FakeFlashcardSetsStore()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_retriever] = lambda: LocalRetriever()
    app.dependency_overrides[get_ai_client] = lambda: LocalAiClient()
    app.dependency_overrides[get_flashcard_sets_store] = lambda: flashcard_sets_store
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    first = local_client.post("/flashcards/generate", json={"projectId": "project-1", "docIds": ["doc-1"], "cardCount": 2})
    second = local_client.post("/flashcards/generate", json={"projectId": "project-1", "docIds": ["doc-2"], "cardCount": 2})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["setId"] != second.json()["setId"]
    assert first.json()["sk"] != second.json()["sk"]
    assert len(flashcard_sets_store.list_sets("user-123", "project-1")) == 2
