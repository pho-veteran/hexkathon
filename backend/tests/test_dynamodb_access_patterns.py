from src.adapters.userstore import ChatMessagesStore, DocumentsStore, QuizzesStore


def test_documents_store_uses_query_path_not_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = DocumentsStore.__new__(DocumentsStore)
    store.table = FakeTable()

    store.list_documents("user-1")

    assert calls[0][0] == "query"
    assert calls[0][1]["KeyConditionExpression"] == "userId = :user_id AND begins_with(sk, :prefix)"
    assert calls[0][1]["ExpressionAttributeValues"] == {":user_id": "user-1", ":prefix": "DOC#"}


def test_chat_store_uses_query_path_not_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ChatMessagesStore.__new__(ChatMessagesStore)
    store.table = FakeTable()

    store.list_messages("user-1", limit=7)

    assert calls[0][0] == "query"
    assert calls[0][1]["KeyConditionExpression"] == "userId = :user_id AND begins_with(sk, :prefix)"
    assert calls[0][1]["ExpressionAttributeValues"] == {":user_id": "user-1", ":prefix": "CHAT#"}
    assert calls[0][1]["ScanIndexForward"] is False
    assert calls[0][1]["Limit"] == 7


def test_quizzes_store_uses_get_item_for_exact_lookup():
    calls = []

    class FakeTable:
        def get_item(self, **kwargs):
            calls.append(("get_item", kwargs))
            return {"Item": None}

    store = QuizzesStore.__new__(QuizzesStore)
    store.table = FakeTable()

    store.get_quiz("user-1", "quiz-1")

    assert calls[0][0] == "get_item"
    assert calls[0][1]["Key"] == {"userId": "user-1", "sk": "QUIZ#quiz-1"}
