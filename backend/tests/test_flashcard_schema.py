from src.handlers import build_flashcard_prompt, parse_flashcard_response



def test_build_flashcard_prompt_asks_for_strict_json():
    prompt = build_flashcard_prompt(
        context="Math notes", count=5, doc_ids=["doc-1"]
    )
    assert "5 flashcards" in prompt
    assert "docId" in prompt or "doc-1" in prompt
    assert "JSON" in prompt



def test_parse_flashcard_response_returns_normalized_cards():
    raw = '''{"cards": [{"id":"1","front":"Q1","back":"A1","source":"page 1"}]}'''
    parsed = parse_flashcard_response(raw, "doc-1")
    assert len(parsed["cards"]) == 1
    assert parsed["cards"][0]["front"] == "Q1"


def test_generated_flashcard_sets_need_unique_ids():
    first_set_id = "set-1"
    second_set_id = "set-2"

    first_key = f"FLASHCARD#{first_set_id}"
    second_key = f"FLASHCARD#{second_set_id}"

    assert first_key != second_key
