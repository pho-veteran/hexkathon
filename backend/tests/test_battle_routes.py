from copy import deepcopy

from fastapi.testclient import TestClient
from src.app import create_app, get_battle_sessions_store, get_current_user_id, get_quizzes_store


class FakeQuizzesStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str, str], dict] = {}

    def put_quiz(self, item: dict) -> None:
        self.items[(item["userId"], item["projectId"], item["quizId"])] = item

    def get_quiz(self, user_id: str, project_id: str, quiz_id: str) -> dict | None:
        quiz = self.items.get((user_id, project_id, quiz_id))
        return deepcopy(quiz) if quiz else None


class FakeBattleSessionsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str, str], dict] = {}

    def put_session(self, item: dict) -> None:
        self.items[(item["userId"], item["projectId"], item["sessionId"])] = deepcopy(item)

    def get_session(self, user_id: str, project_id: str, session_id: str) -> dict | None:
        session = self.items.get((user_id, project_id, session_id))
        return deepcopy(session) if session else None


client = TestClient(create_app())


def test_battle_routes_require_authentication():
    response = client.post("/battle-sessions/start", json={"projectId": "project-1", "quizId": "q1"})
    assert response.status_code == 401

    response = client.post("/battle-sessions/s1/answers?projectId=project-1", json={"questionId": "q1", "selectedChoiceId": "A"})
    assert response.status_code == 401


def test_start_battle_returns_generated_session_and_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    sessions_store = FakeBattleSessionsStore()
    quiz = {"userId": "user-123", "projectId": "project-1", "sk": "QUIZ#project-1#quiz-1", "quizId": "quiz-1", "title": "Boss Battle Quiz", "docIds": ["doc-1"], "bossPersona": {"name": "Hydra"}, "questions": [{"questionId": "q-1", "prompt": "What is 2 + 2?", "choices": [{"choiceId": "A", "text": "4"}, {"choiceId": "B", "text": "5"}], "correctChoiceId": "A", "bossCorrectLine": "Correct.", "bossWrongLine": "Wrong."}], "createdAt": "2026-05-27T00:00:00Z"}
    quizzes_store.put_quiz(quiz)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_battle_sessions_store] = lambda: sessions_store
    local_client = TestClient(app)

    response = local_client.post("/battle-sessions/start", json={"projectId": "project-1", "quizId": "quiz-1"})

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["sk"] == f"BATTLE#project-1#{session['sessionId']}"
    assert session["projectId"] == "project-1"


def test_get_battle_session_returns_authenticated_users_session_and_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    sessions_store = FakeBattleSessionsStore()
    quiz = {"userId": "user-123", "projectId": "project-1", "sk": "QUIZ#project-1#quiz-2", "quizId": "quiz-2", "title": "Quiz 2", "docIds": ["doc-2"], "bossPersona": {"name": "Kraken"}, "questions": [], "createdAt": "2026-05-27T00:00:00Z"}
    session = {"userId": "user-123", "projectId": "project-1", "sk": "BATTLE#project-1#session-2", "sessionId": "session-2", "quizId": "quiz-2", "bossHp": 100, "userHp": 100, "currentQuestionIndex": 0, "answerHistory": [], "status": "active", "startedAt": "2026-05-27T00:00:00Z", "updatedAt": "2026-05-27T00:00:00Z"}
    quizzes_store.put_quiz(quiz)
    sessions_store.put_session(session)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_battle_sessions_store] = lambda: sessions_store
    local_client = TestClient(app)

    response = local_client.get("/battle-sessions/session-2?projectId=project-1")

    assert response.status_code == 200
    assert response.json() == {"session": session, "quiz": quiz}
