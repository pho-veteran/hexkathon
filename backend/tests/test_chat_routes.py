from fastapi.testclient import TestClient
from src.app import create_app, get_ai_client, get_chat_messages_store, get_chat_threads_store, get_current_user_id, get_retriever


class FakeRetriever:
    def retrieve(self, query: str, user_id: str, doc_ids=None, top_k: int = 20) -> list[dict]:
        return [{"text": "Grounded context.", "metadata": {"filename": "doc.txt", "locator": "p1"}, "doc_id": "doc-1", "score": 0.9}]


class FakeAiClient:
    def build_grounded_prompt(self, question: str, context: str, citations: list[dict]) -> str:
        return question

    def invoke(self, prompt: str, max_tokens: int = 4096) -> str:
        return "Answer"


class FakeChatThreadsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_thread(self, item: dict) -> None:
        self.items[(item["projectId"], item["threadId"])] = item

    def list_threads(self, user_id: str, project_id: str) -> list[dict]:
        return [item for (stored_project_id, _), item in self.items.items() if item["userId"] == user_id and stored_project_id == project_id]

    def get_thread(self, user_id: str, project_id: str, thread_id: str) -> dict | None:
        item = self.items.get((project_id, thread_id))
        if item and item["userId"] == user_id:
            return item
        return None


class FakeChatMessagesStore:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    def put_message(self, item: dict) -> None:
        self.messages.append(item)

    def list_messages(self, user_id: str, project_id: str, thread_id: str, limit: int = 50) -> list[dict]:
        return [m for m in self.messages if m["userId"] == user_id and m["projectId"] == project_id and m["threadId"] == thread_id][:limit]


client = TestClient(create_app())


def test_thread_routes_require_authentication():
    assert client.get("/chat/threads?projectId=project-1").status_code == 401
    assert client.post("/chat/threads", json={"projectId": "project-1", "title": "New Chat"}).status_code == 401


def test_thread_message_routes_require_authentication():
    assert client.get("/chat/threads/thread-1/messages?projectId=project-1").status_code == 401
    assert client.post("/chat/threads/thread-1/messages", json={"projectId": "project-1", "question": "hello", "docIds": []}).status_code == 401


def test_create_and_list_thread_messages_are_project_scoped():
    app = create_app()
    threads_store = FakeChatThreadsStore()
    messages_store = FakeChatMessagesStore()
    threads_store.put_thread({"userId": "user-123", "projectId": "project-1", "threadId": "thread-1", "title": "Alpha", "sk": "THREAD#project-1#2026#thread-1"})
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_chat_threads_store] = lambda: threads_store
    app.dependency_overrides[get_chat_messages_store] = lambda: messages_store
    app.dependency_overrides[get_retriever] = lambda: FakeRetriever()
    app.dependency_overrides[get_ai_client] = lambda: FakeAiClient()
    local_client = TestClient(app)

    response = local_client.post("/chat/threads/thread-1/messages", json={"projectId": "project-1", "question": "hello", "docIds": ["doc-1"]})

    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] == "project-1"
    assert body["threadId"] == "thread-1"
    listed = local_client.get("/chat/threads/thread-1/messages?projectId=project-1")
    assert listed.status_code == 200
    assert len(listed.json()["messages"]) == 2


def test_build_chat_message_item_uses_unique_message_ids_in_sort_key():
    from src.handlers import build_chat_message_item

    first = build_chat_message_item(
        user_id="user-1",
        project_id="project-1",
        thread_id="thread-1",
        message_id="msg-1",
        role="user",
        content="hello",
        doc_ids=[],
        created_at="2026-05-28T00:00:00Z",
        citations=[],
    )
    second = build_chat_message_item(
        user_id="user-1",
        project_id="project-1",
        thread_id="thread-1",
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
