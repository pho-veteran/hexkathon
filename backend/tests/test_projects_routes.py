from fastapi.testclient import TestClient
from src.app import create_app, get_current_user_id, get_projects_store


class FakeProjectsStore:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def put_project(self, item: dict) -> None:
        self.items[(item["userId"], item["projectId"])] = item

    def list_projects(self, user_id: str) -> list[dict]:
        return [item for (stored_user_id, _), item in self.items.items() if stored_user_id == user_id]

    def get_project(self, user_id: str, project_id: str) -> dict | None:
        return self.items.get((user_id, project_id))

    def delete_project(self, user_id: str, project_id: str) -> None:
        self.items.pop((user_id, project_id), None)


client = TestClient(create_app())


def test_projects_routes_require_authentication():
    assert client.get("/projects").status_code == 401
    assert client.post("/projects", json={"name": "Alpha"}).status_code == 401
    assert client.patch("/projects/project-1", json={"name": "Beta"}).status_code == 401
    assert client.delete("/projects/project-1").status_code == 401


def test_list_projects_returns_authenticated_users_projects():
    app = create_app()
    projects_store = FakeProjectsStore()
    alpha = {
        "userId": "user-123",
        "sk": "PROJECT#project-1",
        "projectId": "project-1",
        "name": "Alpha",
        "createdAt": "2026-05-28T00:00:00Z",
        "updatedAt": "2026-05-28T00:00:00Z",
    }
    other = {
        "userId": "other-user",
        "sk": "PROJECT#project-2",
        "projectId": "project-2",
        "name": "Beta",
        "createdAt": "2026-05-28T00:00:00Z",
        "updatedAt": "2026-05-28T00:00:00Z",
    }
    projects_store.put_project(alpha)
    projects_store.put_project(other)
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.get("/projects")

    assert response.status_code == 200
    assert response.json() == {"projects": [alpha]}


def test_create_project_rejects_blank_name():
    app = create_app()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.post("/projects", json={"name": "   "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Project name is required"


def test_create_project_rejects_duplicate_name_for_same_user_case_insensitively():
    app = create_app()
    projects_store = FakeProjectsStore()
    projects_store.put_project(
        {
            "userId": "user-123",
            "sk": "PROJECT#project-1",
            "projectId": "project-1",
            "name": "Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    projects_store.put_project(
        {
            "userId": "other-user",
            "sk": "PROJECT#project-9",
            "projectId": "project-9",
            "name": "Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.post("/projects", json={"name": " alpha "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Project name already exists"


def test_create_project_persists_trimmed_name_for_authenticated_user():
    app = create_app()
    projects_store = FakeProjectsStore()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.post("/projects", json={"name": "  Alpha  "})

    assert response.status_code == 200
    body = response.json()
    assert body["userId"] == "user-123"
    assert body["sk"] == f"PROJECT#{body['projectId']}"
    assert body["name"] == "Alpha"
    assert body["createdAt"] == body["updatedAt"]
    assert projects_store.get_project("user-123", body["projectId"]) == body


def test_patch_project_updates_name_and_updated_at():
    app = create_app()
    projects_store = FakeProjectsStore()
    projects_store.put_project(
        {
            "userId": "user-123",
            "sk": "PROJECT#project-1",
            "projectId": "project-1",
            "name": "Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.patch("/projects/project-1", json={"name": "  Beta  "})

    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] == "project-1"
    assert body["name"] == "Beta"
    assert body["createdAt"] == "2026-05-28T00:00:00Z"
    assert body["updatedAt"] != "2026-05-28T00:00:00Z"
    assert projects_store.get_project("user-123", "project-1") == body


def test_patch_project_rejects_duplicate_name_for_same_user():
    app = create_app()
    projects_store = FakeProjectsStore()
    projects_store.put_project(
        {
            "userId": "user-123",
            "sk": "PROJECT#project-1",
            "projectId": "project-1",
            "name": "Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    projects_store.put_project(
        {
            "userId": "user-123",
            "sk": "PROJECT#project-2",
            "projectId": "project-2",
            "name": "Beta",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.patch("/projects/project-1", json={"name": " beta "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Project name already exists"


def test_patch_project_returns_404_when_project_missing():
    app = create_app()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.patch("/projects/project-404", json={"name": "Beta"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_delete_project_removes_owned_project_only():
    app = create_app()
    projects_store = FakeProjectsStore()
    projects_store.put_project(
        {
            "userId": "user-123",
            "sk": "PROJECT#project-1",
            "projectId": "project-1",
            "name": "Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    projects_store.put_project(
        {
            "userId": "other-user",
            "sk": "PROJECT#project-1",
            "projectId": "project-1",
            "name": "Other Alpha",
            "createdAt": "2026-05-28T00:00:00Z",
            "updatedAt": "2026-05-28T00:00:00Z",
        }
    )
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: projects_store
    local_client = TestClient(app)

    response = local_client.delete("/projects/project-1")

    assert response.status_code == 200
    assert response.json() == {"deleted": True, "projectId": "project-1"}
    assert projects_store.get_project("user-123", "project-1") is None
    assert projects_store.get_project("other-user", "project-1") is not None


def test_delete_project_returns_404_when_project_missing():
    app = create_app()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.delete("/projects/project-404")

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"
