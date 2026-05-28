from src.handlers import build_chat_message_item



def test_build_chat_message_item_uses_project_and_thread_in_sort_key():
    item = build_chat_message_item(
        user_id="user-1",
        project_id="project-1",
        thread_id="thread-1",
        message_id="msg-1",
        role="user",
        content="What is gradient descent?",
        doc_ids=["doc-a"],
        created_at="2026-05-27T00:00:00Z",
        citations=[],
    )

    assert item["userId"] == "user-1"
    assert item["projectId"] == "project-1"
    assert item["threadId"] == "thread-1"
    assert item["sk"] == "CHAT#project-1#thread-1#2026-05-27T00:00:00Z#msg-1"
    assert item["role"] == "user"
