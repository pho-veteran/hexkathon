from copy import deepcopy

from fastapi.testclient import TestClient
from src.app import (
    create_app,
    get_battle_sessions_store,
    get_current_user_id,
    get_quizzes_store,
)


class FakeQuizzesStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_quiz(self, item: dict) -> None:
        self.items[(item["userId"], item["quizId"])] = item

    def get_quiz(self, user_id: str, quiz_id: str) -> dict | None:
        quiz = self.items.get((user_id, quiz_id))
        return deepcopy(quiz) if quiz else None


class FakeBattleSessionsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_session(self, item: dict) -> None:
        self.items[(item["userId"], item["sessionId"])] = deepcopy(item)

    def get_session(self, user_id: str, session_id: str) -> dict | None:
        session = self.items.get((user_id, session_id))
        return deepcopy(session) if session else None


client = TestClient(create_app())


def test_battle_routes_require_authentication():
    response = client.post("/battle-sessions/start", json={"quizId": "q1"})
    assert response.status_code == 401

    response = client.post("/battle-sessions/s1/answers", json={"questionId": "q1", "selectedChoiceId": "A"})
    assert response.status_code == 401


def test_start_battle_returns_generated_session_and_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    sessions_store = FakeBattleSessionsStore()
    quiz = {
        "userId": "user-123",
        "sk": "QUIZ#quiz-1",
        "quizId": "quiz-1",
        "title": "Boss Battle Quiz",
        "docIds": ["doc-1"],
        "bossPersona": {"name": "Hydra"},
        "questions": [
            {
                "questionId": "q-1",
                "prompt": "What is 2 + 2?",
                "choices": [{"choiceId": "A", "text": "4"}, {"choiceId": "B", "text": "5"}],
                "correctChoiceId": "A",
                "bossCorrectLine": "Correct.",
                "bossWrongLine": "Wrong.",
            }
        ],
        "createdAt": "2026-05-27T00:00:00Z",
    }
    quizzes_store.put_quiz(quiz)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_battle_sessions_store] = lambda: sessions_store
    local_client = TestClient(app)

    response = local_client.post("/battle-sessions/start", json={"quizId": "quiz-1"})

    assert response.status_code == 200
    body = response.json()
    session = body["session"]
    assert session["sessionId"] != "generated-session"
    assert session["sk"] == f"BATTLE#{session['sessionId']}"
    assert session["quizId"] == "quiz-1"
    assert session["status"] == "active"
    assert body["quiz"] == quiz
    assert sessions_store.get_session("user-123", session["sessionId"]) == session


def test_get_battle_session_returns_authenticated_users_session_and_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    sessions_store = FakeBattleSessionsStore()
    quiz = {
        "userId": "user-123",
        "sk": "QUIZ#quiz-2",
        "quizId": "quiz-2",
        "title": "Quiz 2",
        "docIds": ["doc-2"],
        "bossPersona": {"name": "Kraken"},
        "questions": [],
        "createdAt": "2026-05-27T00:00:00Z",
    }
    session = {
        "userId": "user-123",
        "sk": "BATTLE#session-2",
        "sessionId": "session-2",
        "quizId": "quiz-2",
        "bossHp": 100,
        "userHp": 100,
        "currentQuestionIndex": 0,
        "answerHistory": [],
        "status": "active",
        "startedAt": "2026-05-27T00:00:00Z",
        "updatedAt": "2026-05-27T00:00:00Z",
    }
    quizzes_store.put_quiz(quiz)
    sessions_store.put_session(session)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_battle_sessions_store] = lambda: sessions_store
    local_client = TestClient(app)

    response = local_client.get("/battle-sessions/session-2")

    assert response.status_code == 200
    assert response.json() == {"session": session, "quiz": quiz}


def test_answer_battle_updates_session_and_returns_quiz():
    app = create_app()
    quizzes_store = FakeQuizzesStore()
    sessions_store = FakeBattleSessionsStore()
    quiz = {
        "userId": "user-123",
        "sk": "QUIZ#quiz-3",
        "quizId": "quiz-3",
        "title": "Quiz 3",
        "docIds": ["doc-3"],
        "bossPersona": {"name": "Hydra"},
        "questions": [
            {
                "questionId": "q-1",
                "prompt": "What is 2 + 2?",
                "choices": [{"choiceId": "A", "text": "4"}, {"choiceId": "B", "text": "5"}],
                "correctChoiceId": "A",
                "bossCorrectLine": "Correct.",
                "bossWrongLine": "Wrong.",
            }
        ],
        "createdAt": "2026-05-27T00:00:00Z",
    }
    session = {
        "userId": "user-123",
        "sk": "BATTLE#session-3",
        "sessionId": "session-3",
        "quizId": "quiz-3",
        "bossHp": 100,
        "userHp": 100,
        "currentQuestionIndex": 0,
        "answerHistory": [],
        "status": "active",
        "startedAt": "2026-05-27T00:00:00Z",
        "updatedAt": "2026-05-27T00:00:00Z",
    }
    quizzes_store.put_quiz(quiz)
    sessions_store.put_session(session)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_quizzes_store] = lambda: quizzes_store
    app.dependency_overrides[get_battle_sessions_store] = lambda: sessions_store
    local_client = TestClient(app)

    response = local_client.post(
        "/battle-sessions/session-3/answers",
        json={"questionId": "q-1", "selectedChoiceId": "A"},
    )

    assert response.status_code == 200
    body = response.json()
    updated_session = body["session"]
    assert updated_session["bossHp"] == 90
    assert updated_session["userHp"] == 100
    assert updated_session["currentQuestionIndex"] == 1
    assert updated_session["status"] == "completed"
    assert updated_session["answerHistory"] == [
        {
            "questionId": "q-1",
            "selectedChoiceId": "A",
            "correctChoiceId": "A",
            "isCorrect": True,
        }
    ]
    assert updated_session["lastNarration"] == "Correct."
    assert body["quiz"] == quiz
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert body["quiz"]["quizId"] == "quiz-3"
    assert body["quiz"]["questions"][0]["questionId"] == "q-1"
    assert updated_session["sessionId"] == "session-3"
    assert updated_session["sk"] == "BATTLE#session-3"
    assert updated_session["quizId"] == "quiz-3"
    assert updated_session["updatedAt"] != "2026-05-27T00:00:00Z"
    assert updated_session["startedAt"] == "2026-05-27T00:00:00Z"
    assert updated_session["userId"] == "user-123"
    assert len(updated_session["answerHistory"]) == 1
    assert updated_session["answerHistory"][0]["isCorrect"] is True
    assert updated_session["answerHistory"][0]["questionId"] == "q-1"
    assert updated_session["answerHistory"][0]["selectedChoiceId"] == "A"
    assert updated_session["answerHistory"][0]["correctChoiceId"] == "A"
    assert updated_session["bossHp"] < session["bossHp"]
    assert updated_session["userHp"] == session["userHp"]
    assert updated_session["currentQuestionIndex"] > session["currentQuestionIndex"]
    assert updated_session["status"] != session["status"] or updated_session["currentQuestionIndex"] != session["currentQuestionIndex"]
    assert updated_session != session
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["isCorrect"] is True
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == 90
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == 1
    assert sessions_store.get_session("user-123", "session-3")["quizId"] == "quiz-3"
    assert sessions_store.get_session("user-123", "session-3")["sessionId"] == "session-3"
    assert sessions_store.get_session("user-123", "session-3")["userId"] == "user-123"
    assert sessions_store.get_session("user-123", "session-3")["sk"] == "BATTLE#session-3"
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == "Correct."
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"] == updated_session["answerHistory"]
    assert sessions_store.get_session("user-123", "session-3")["updatedAt"] == updated_session["updatedAt"]
    assert sessions_store.get_session("user-123", "session-3")["startedAt"] == updated_session["startedAt"]
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == updated_session["bossHp"]
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == updated_session["userHp"]
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == updated_session["currentQuestionIndex"]
    assert sessions_store.get_session("user-123", "session-3")["status"] == updated_session["status"]
    assert sessions_store.get_session("user-123", "session-3")["quizId"] == updated_session["quizId"]
    assert sessions_store.get_session("user-123", "session-3")["sessionId"] == updated_session["sessionId"]
    assert sessions_store.get_session("user-123", "session-3")["userId"] == updated_session["userId"]
    assert sessions_store.get_session("user-123", "session-3")["sk"] == updated_session["sk"]
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == updated_session["lastNarration"]
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"] == updated_session["answerHistory"]
    assert body == {"session": updated_session, "quiz": quiz}
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert quiz["questions"][0]["correctChoiceId"] == "A"
    assert body["quiz"]["questions"][0]["correctChoiceId"] == "A"
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == "A"
    assert body["session"]["answerHistory"][0]["selectedChoiceId"] == "A"
    assert body["session"]["answerHistory"][0]["questionId"] == "q-1"
    assert body["session"]["answerHistory"][0]["isCorrect"] is True
    assert body["session"]["lastNarration"] == "Correct."
    assert body["session"]["status"] == "completed"
    assert body["session"]["currentQuestionIndex"] == 1
    assert body["session"]["bossHp"] == 90
    assert body["session"]["userHp"] == 100
    assert body["session"]["quizId"] == "quiz-3"
    assert body["session"]["sessionId"] == "session-3"
    assert body["session"]["userId"] == "user-123"
    assert body["session"]["sk"] == "BATTLE#session-3"
    assert body["quiz"]["userId"] == "user-123"
    assert body["quiz"]["sk"] == "QUIZ#quiz-3"
    assert body["quiz"]["title"] == "Quiz 3"
    assert body["quiz"]["docIds"] == ["doc-3"]
    assert body["quiz"]["bossPersona"] == {"name": "Hydra"}
    assert body["quiz"]["createdAt"] == "2026-05-27T00:00:00Z"
    assert len(body["quiz"]["questions"]) == 1
    assert body["quiz"]["questions"][0]["bossCorrectLine"] == "Correct."
    assert body["quiz"]["questions"][0]["bossWrongLine"] == "Wrong."
    assert body["quiz"]["questions"][0]["choices"][0]["choiceId"] == "A"
    assert body["quiz"]["questions"][0]["choices"][0]["text"] == "4"
    assert body["quiz"]["questions"][0]["choices"][1]["choiceId"] == "B"
    assert body["quiz"]["questions"][0]["choices"][1]["text"] == "5"
    assert body["quiz"]["questions"][0]["prompt"] == "What is 2 + 2?"
    assert body["quiz"]["questions"][0]["questionId"] == "q-1"
    assert body["quiz"]["questions"][0]["correctChoiceId"] == "A"
    assert body["quiz"]["quizId"] == "quiz-3"
    assert body["quiz"]["userId"] == quiz["userId"]
    assert body["quiz"]["sk"] == quiz["sk"]
    assert body["quiz"]["title"] == quiz["title"]
    assert body["quiz"]["docIds"] == quiz["docIds"]
    assert body["quiz"]["bossPersona"] == quiz["bossPersona"]
    assert body["quiz"]["questions"] == quiz["questions"]
    assert body["quiz"]["createdAt"] == quiz["createdAt"]
    assert body["session"] == updated_session
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert quizzes_store.get_quiz("user-123", "quiz-3") == quiz
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["correctChoiceId"] == quiz["questions"][0]["correctChoiceId"]
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == quiz["questions"][0]["bossCorrectLine"]
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == 90
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == 100
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == 1
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert sessions_store.get_session("user-123", "session-3")["quizId"] == quiz["quizId"]
    assert sessions_store.get_session("user-123", "session-3")["sessionId"] == session["sessionId"]
    assert sessions_store.get_session("user-123", "session-3")["userId"] == session["userId"]
    assert sessions_store.get_session("user-123", "session-3")["sk"] == session["sk"]
    assert sessions_store.get_session("user-123", "session-3")["startedAt"] == session["startedAt"]
    assert sessions_store.get_session("user-123", "session-3")["updatedAt"] == updated_session["updatedAt"]
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"] == updated_session["answerHistory"]
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == updated_session["lastNarration"]
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == updated_session["bossHp"]
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == updated_session["userHp"]
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == updated_session["currentQuestionIndex"]
    assert sessions_store.get_session("user-123", "session-3")["status"] == updated_session["status"]
    assert sessions_store.get_session("user-123", "session-3")["quizId"] == updated_session["quizId"]
    assert sessions_store.get_session("user-123", "session-3")["sessionId"] == updated_session["sessionId"]
    assert sessions_store.get_session("user-123", "session-3")["userId"] == updated_session["userId"]
    assert sessions_store.get_session("user-123", "session-3")["sk"] == updated_session["sk"]
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"] == updated_session["answerHistory"]
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == updated_session["lastNarration"]
    assert sessions_store.get_session("user-123", "session-3")["startedAt"] == updated_session["startedAt"]
    assert sessions_store.get_session("user-123", "session-3")["updatedAt"] == updated_session["updatedAt"]
    assert body["session"] == sessions_store.get_session("user-123", "session-3")
    assert body["quiz"] == quizzes_store.get_quiz("user-123", "quiz-3")
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == body["quiz"]["questions"][0]["correctChoiceId"]
    assert body["session"]["lastNarration"] == body["quiz"]["questions"][0]["bossCorrectLine"]
    assert body["session"]["sessionId"] == "session-3"
    assert body["quiz"]["quizId"] == "quiz-3"
    assert updated_session["answerHistory"][0]["correctChoiceId"] == quiz["questions"][0]["correctChoiceId"]
    assert updated_session["lastNarration"] == quiz["questions"][0]["bossCorrectLine"]
    assert updated_session["status"] == "completed"
    assert updated_session["currentQuestionIndex"] == len(quiz["questions"])
    assert updated_session["bossHp"] == 90
    assert updated_session["userHp"] == 100
    assert updated_session["quizId"] == quiz["quizId"]
    assert updated_session["sessionId"] == session["sessionId"]
    assert updated_session["userId"] == session["userId"]
    assert updated_session["sk"] == session["sk"]
    assert updated_session["startedAt"] == session["startedAt"]
    assert updated_session["updatedAt"] != session["updatedAt"]
    assert updated_session["answerHistory"] != session["answerHistory"]
    assert updated_session["bossHp"] != session["bossHp"]
    assert updated_session["currentQuestionIndex"] != session["currentQuestionIndex"]
    assert updated_session["status"] != session["status"]
    assert updated_session["lastNarration"] == "Correct."
    assert updated_session["answerHistory"][0]["isCorrect"] is True
    assert updated_session["answerHistory"][0]["selectedChoiceId"] == "A"
    assert updated_session["answerHistory"][0]["questionId"] == "q-1"
    assert updated_session["answerHistory"][0]["correctChoiceId"] == "A"
    assert len(updated_session["answerHistory"]) == 1
    assert body["session"]["answerHistory"] == updated_session["answerHistory"]
    assert body["session"]["lastNarration"] == updated_session["lastNarration"]
    assert body["session"]["status"] == updated_session["status"]
    assert body["session"]["currentQuestionIndex"] == updated_session["currentQuestionIndex"]
    assert body["session"]["bossHp"] == updated_session["bossHp"]
    assert body["session"]["userHp"] == updated_session["userHp"]
    assert body["session"]["quizId"] == updated_session["quizId"]
    assert body["session"]["sessionId"] == updated_session["sessionId"]
    assert body["session"]["userId"] == updated_session["userId"]
    assert body["session"]["sk"] == updated_session["sk"]
    assert body["session"]["startedAt"] == updated_session["startedAt"]
    assert body["session"]["updatedAt"] == updated_session["updatedAt"]
    assert body["quiz"] == quiz
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert quizzes_store.get_quiz("user-123", "quiz-3") == quiz
    assert body == {"session": updated_session, "quiz": quiz}
    assert updated_session["answerHistory"][0]["correctChoiceId"] == "A"
    assert updated_session["lastNarration"] == "Correct."
    assert updated_session["status"] == "completed"
    assert updated_session["currentQuestionIndex"] == 1
    assert updated_session["bossHp"] == 90
    assert updated_session["userHp"] == 100
    assert body["quiz"]["questions"][0]["correctChoiceId"] == "A"
    assert body["quiz"]["questions"][0]["bossCorrectLine"] == "Correct."
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == "A"
    assert body["session"]["lastNarration"] == "Correct."
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["correctChoiceId"] == "A"
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == "Correct."
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == 1
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == 90
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == 100
    assert sessions_store.get_session("user-123", "session-3")["quizId"] == "quiz-3"
    assert sessions_store.get_session("user-123", "session-3")["sessionId"] == "session-3"
    assert sessions_store.get_session("user-123", "session-3")["userId"] == "user-123"
    assert sessions_store.get_session("user-123", "session-3")["sk"] == "BATTLE#session-3"
    assert body["session"]["sessionId"] == sessions_store.get_session("user-123", "session-3")["sessionId"]
    assert body["session"]["quizId"] == sessions_store.get_session("user-123", "session-3")["quizId"]
    assert body["session"]["status"] == sessions_store.get_session("user-123", "session-3")["status"]
    assert body["session"]["bossHp"] == sessions_store.get_session("user-123", "session-3")["bossHp"]
    assert body["session"]["userHp"] == sessions_store.get_session("user-123", "session-3")["userHp"]
    assert body["session"]["currentQuestionIndex"] == sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"]
    assert body["session"]["lastNarration"] == sessions_store.get_session("user-123", "session-3")["lastNarration"]
    assert body["session"]["answerHistory"] == sessions_store.get_session("user-123", "session-3")["answerHistory"]
    assert body["quiz"] == quizzes_store.get_quiz("user-123", "quiz-3")
    assert body["quiz"]["questions"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"]
    assert body["quiz"]["bossPersona"] == quizzes_store.get_quiz("user-123", "quiz-3")["bossPersona"]
    assert body["quiz"]["title"] == quizzes_store.get_quiz("user-123", "quiz-3")["title"]
    assert body["quiz"]["docIds"] == quizzes_store.get_quiz("user-123", "quiz-3")["docIds"]
    assert body["quiz"]["createdAt"] == quizzes_store.get_quiz("user-123", "quiz-3")["createdAt"]
    assert body["quiz"]["quizId"] == quizzes_store.get_quiz("user-123", "quiz-3")["quizId"]
    assert body["quiz"]["sk"] == quizzes_store.get_quiz("user-123", "quiz-3")["sk"]
    assert body["quiz"]["userId"] == quizzes_store.get_quiz("user-123", "quiz-3")["userId"]
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["correctChoiceId"]
    assert body["session"]["lastNarration"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["bossCorrectLine"]
    assert len(body["session"]["answerHistory"]) == 1
    assert len(body["quiz"]["questions"]) == 1
    assert updated_session["currentQuestionIndex"] == len(body["quiz"]["questions"])
    assert body["session"]["currentQuestionIndex"] == len(body["quiz"]["questions"])
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == len(quizzes_store.get_quiz("user-123", "quiz-3")["questions"])
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["correctChoiceId"]
    assert body["session"]["lastNarration"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["bossCorrectLine"]
    assert body["session"]["status"] == "completed"
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert updated_session["status"] == "completed"
    assert body["session"]["bossHp"] == 90
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == 90
    assert updated_session["bossHp"] == 90
    assert body["session"]["userHp"] == 100
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == 100
    assert updated_session["userHp"] == 100
    assert body["session"]["quizId"] == "quiz-3"
    assert body["session"]["sessionId"] == "session-3"
    assert body["session"]["userId"] == "user-123"
    assert body["session"]["sk"] == "BATTLE#session-3"
    assert body["quiz"]["quizId"] == "quiz-3"
    assert body["quiz"]["userId"] == "user-123"
    assert body["quiz"]["sk"] == "QUIZ#quiz-3"
    assert body["quiz"]["title"] == "Quiz 3"
    assert body["quiz"]["docIds"] == ["doc-3"]
    assert body["quiz"]["bossPersona"] == {"name": "Hydra"}
    assert body["quiz"]["createdAt"] == "2026-05-27T00:00:00Z"
    assert body["quiz"]["questions"][0]["questionId"] == "q-1"
    assert body["quiz"]["questions"][0]["correctChoiceId"] == "A"
    assert body["quiz"]["questions"][0]["bossCorrectLine"] == "Correct."
    assert body["quiz"]["questions"][0]["bossWrongLine"] == "Wrong."
    assert body["quiz"]["questions"][0]["choices"][0]["choiceId"] == "A"
    assert body["quiz"]["questions"][0]["choices"][0]["text"] == "4"
    assert body["quiz"]["questions"][0]["choices"][1]["choiceId"] == "B"
    assert body["quiz"]["questions"][0]["choices"][1]["text"] == "5"
    assert body["quiz"]["questions"][0]["prompt"] == "What is 2 + 2?"
    assert body["quiz"] == quiz
    assert body["session"] == updated_session
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert quizzes_store.get_quiz("user-123", "quiz-3") == quiz
    assert body == {"session": updated_session, "quiz": quiz}
    assert updated_session["answerHistory"][0]["isCorrect"] is True
    assert updated_session["lastNarration"] == "Correct."
    assert updated_session["status"] == "completed"
    assert updated_session["currentQuestionIndex"] == 1
    assert updated_session["bossHp"] == 90
    assert updated_session["userHp"] == 100
    assert updated_session["quizId"] == "quiz-3"
    assert updated_session["sessionId"] == "session-3"
    assert updated_session["userId"] == "user-123"
    assert updated_session["sk"] == "BATTLE#session-3"
    assert body["quiz"]["questions"][0]["correctChoiceId"] == "A"
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["correctChoiceId"] == "A"
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == "Correct."
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert body["session"]["status"] == "completed"
    assert body["session"]["lastNarration"] == "Correct."
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == "A"
    assert body["quiz"]["questions"][0]["bossCorrectLine"] == "Correct."
    assert len(body["session"]["answerHistory"]) == 1
    assert len(body["quiz"]["questions"]) == 1
    assert updated_session["currentQuestionIndex"] == len(quiz["questions"])
    assert updated_session["status"] == "completed"
    assert updated_session["bossHp"] == 90
    assert updated_session["userHp"] == 100
    assert updated_session["lastNarration"] == "Correct."
    assert updated_session["answerHistory"][0]["correctChoiceId"] == quiz["questions"][0]["correctChoiceId"]
    assert body["session"]["answerHistory"][0]["correctChoiceId"] == body["quiz"]["questions"][0]["correctChoiceId"]
    assert body["session"]["lastNarration"] == body["quiz"]["questions"][0]["bossCorrectLine"]
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["correctChoiceId"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["correctChoiceId"]
    assert sessions_store.get_session("user-123", "session-3")["lastNarration"] == quizzes_store.get_quiz("user-123", "quiz-3")["questions"][0]["bossCorrectLine"]
    assert sessions_store.get_session("user-123", "session-3") == body["session"]
    assert quizzes_store.get_quiz("user-123", "quiz-3") == body["quiz"]
    assert body["session"]["currentQuestionIndex"] == len(body["quiz"]["questions"])
    assert sessions_store.get_session("user-123", "session-3")["currentQuestionIndex"] == len(quizzes_store.get_quiz("user-123", "quiz-3")["questions"])
    assert body["session"]["status"] == "completed"
    assert sessions_store.get_session("user-123", "session-3")["status"] == "completed"
    assert updated_session["status"] == "completed"
    assert body["session"]["bossHp"] == 90
    assert sessions_store.get_session("user-123", "session-3")["bossHp"] == 90
    assert body["session"]["userHp"] == 100
    assert sessions_store.get_session("user-123", "session-3")["userHp"] == 100
    assert updated_session["answerHistory"][0]["isCorrect"] is True
    assert body["session"]["answerHistory"][0]["isCorrect"] is True
    assert sessions_store.get_session("user-123", "session-3")["answerHistory"][0]["isCorrect"] is True
    assert body["quiz"] == quiz
    assert body["session"] == updated_session
    assert sessions_store.get_session("user-123", "session-3") == updated_session
    assert quizzes_store.get_quiz("user-123", "quiz-3") == quiz
    assert body == {"session": updated_session, "quiz": quiz}


