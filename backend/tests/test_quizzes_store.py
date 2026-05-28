from src.handlers import build_quiz_item



def test_build_quiz_item_uses_user_partition_and_quiz_sort_key():
    item = build_quiz_item(
        user_id="user-1",
        project_id="project-1",
        quiz_id="quiz-1",
        title="Exam 1",
        doc_ids=["doc-1"],
        boss_persona={"name": "Boss"},
        questions=[{"questionId": "q1"}],
        created_at="2026-05-27T00:00:00Z",
    )
    assert item["userId"] == "user-1"
    assert item["projectId"] == "project-1"
    assert item["sk"] == "QUIZ#project-1#quiz-1"
    assert item["quizId"] == "quiz-1"
