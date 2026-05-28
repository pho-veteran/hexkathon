from fastapi.testclient import TestClient
from src.app import create_app


client = TestClient(create_app())


def test_chat_routes_require_authentication():
    response = client.get("/chat/messages")
    assert response.status_code == 401

    response = client.post("/chat/messages", json={"question": "", "docIds": []})
    assert response.status_code == 401


def test_build_chat_message_item_uses_unique_message_ids_in_sort_key():
    from src.handlers import build_chat_message_item

    first = build_chat_message_item(
        user_id="user-1",
        message_id="msg-1",
        role="user",
        content="hello",
        doc_ids=[],
        created_at="2026-05-28T00:00:00Z",
        citations=[],
    )
    second = build_chat_message_item(
        user_id="user-1",
        message_id="msg-2",
        role="bot",
        content="world",
        doc_ids=[],
        created_at="2026-05-28T00:00:00Z",
        citations=[],
    )

    assert first["sk"] != second["sk"]
    assert first["sk"].endswith("#msg-1")
    assert second["sk"].endswith("#msg-2")
