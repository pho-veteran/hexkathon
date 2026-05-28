from src.handlers import build_chat_message_item



def test_build_chat_message_item_uses_user_partition_and_chat_sort_key():
    item = build_chat_message_item(
        user_id="user-1",
        message_id="msg-1",
        role="user",
        content="What is gradient descent?",
        doc_ids=["doc-a"],
        created_at="2026-05-27T00:00:00Z",
        citations=[],
    )

    assert item["userId"] == "user-1"
    assert item["sk"].startswith("CHAT#")
    assert item["role"] == "user"
