from fastapi.testclient import TestClient
from src.app import create_app, get_current_user_id, get_projects_store


class FakeProjectsStore:
    def get_project(self, user_id: str, project_id: str) -> dict | None:
        return {"userId": user_id, "projectId": project_id, "name": "Alpha"}


client = TestClient(create_app())


def test_documents_route_requires_authentication():
    response = client.get("/documents?projectId=project-1")
    assert response.status_code == 401


def test_document_upload_requires_project_id():
    app = create_app()
    app.dependency_overrides[get_current_user_id] = lambda: "user-123"
    app.dependency_overrides[get_projects_store] = lambda: FakeProjectsStore()
    local_client = TestClient(app)

    response = local_client.post("/documents/upload", files={"file": ("doc.txt", b"hello", "text/plain")})

    assert response.status_code == 422
    assert "projectId" in response.text
