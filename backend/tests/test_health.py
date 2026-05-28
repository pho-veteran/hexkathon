from fastapi.testclient import TestClient
from src.app import create_app


client = TestClient(create_app())


def test_health_returns_backend_summary():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["backends"].keys()) == {"storage", "userstore", "vector", "ai"}
