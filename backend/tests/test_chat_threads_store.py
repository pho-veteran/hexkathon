from src.adapters.userstore import ChatThreadsStore



def test_chat_threads_store_lists_threads_by_user_and_project_without_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ChatThreadsStore.__new__(ChatThreadsStore)
    store.table = FakeTable()

    store.list_threads("user-1", "project-1")

    assert calls[0][0] == "query"
    assert calls[0][1]["ExpressionAttributeValues"] == {
        ":user_id": "user-1",
        ":prefix": "THREAD#project-1#",
    }
