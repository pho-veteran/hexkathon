from fastapi.testclient import TestClient
from src.app import create_app


client = TestClient(create_app())


def test_upload_requires_authentication():
    response = client.post("/documents/upload")
    assert response.status_code == 401
