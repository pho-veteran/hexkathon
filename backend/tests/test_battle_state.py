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


def test_apply_answer_keeps_completed_session_stable():
    quiz = {
        "quizId": "q1",
        "questions": [{"questionId": "q1", "correctChoiceId": "A", "bossCorrectLine": "Yes.", "bossWrongLine": "No."}]
    }
    session = {
        **start_battle_session(user_id="user-1", session_id="s1", quiz=quiz),
        "currentQuestionIndex": 1,
        "status": "completed",
        "answerHistory": [{"questionId": "q1", "selectedChoiceId": "A", "correctChoiceId": "A", "isCorrect": True}],
    }

    updated = apply_answer(session, quiz, question_id="q1", selected_choice_id="A")

    assert updated == session
