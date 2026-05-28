from src.handlers import normalize_citation



def test_normalize_citation_maps_kb_payload_to_frontend_contract():
    raw = {
        "doc_id": "doc-1",
        "metadata": {"filename": "lesson.pdf", "locator": "page-2"},
        "text": "Gradient descent is iterative.",
        "score": 0.98,
    }

    normalized = normalize_citation("citation-1", raw)

    assert normalized == {
        "citationId": "citation-1",
        "docId": "doc-1",
        "filename": "lesson.pdf",
        "locator": "page-2",
        "excerpt": "Gradient descent is iterative.",
        "score": 0.98,
    }
