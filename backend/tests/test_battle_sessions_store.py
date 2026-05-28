from src.handlers import start_battle_session



def test_start_battle_session_builds_battle_sort_key():
    session = start_battle_session(
        user_id="user-1",
        session_id="s1",
        quiz={"quizId": "q1", "questions": [{"questionId": "q1"}]},
    )
    assert session["sk"] == "BATTLE#s1"
