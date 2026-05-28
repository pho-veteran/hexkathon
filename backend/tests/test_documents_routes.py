from fastapi.testclient import TestClient
from src.app import create_app


client = TestClient(create_app())


def test_documents_route_requires_authentication():
    response = client.get("/documents")
    assert response.status_code == 401
