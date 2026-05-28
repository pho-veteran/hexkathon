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
