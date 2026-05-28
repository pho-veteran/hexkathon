from src.adapters.userstore import ProjectsStore



def test_projects_store_lists_projects_by_user_without_scan():
    calls = []

    class FakeTable:
        def query(self, **kwargs):
            calls.append(("query", kwargs))
            return {"Items": []}

    store = ProjectsStore.__new__(ProjectsStore)
    store.table = FakeTable()

    store.list_projects("user-1")

    assert calls[0][0] == "query"
    assert calls[0][1]["ExpressionAttributeValues"] == {":user_id": "user-1", ":prefix": "PROJECT#"}
