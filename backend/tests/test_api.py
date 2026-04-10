from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


DUMMY_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8V2u8AAAAASUVORK5CYII="


def test_health_endpoint() -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"


def test_math_validation_rejects_short_payload() -> None:
    res = client.post("/api/math/solve", json={"imageBase64": "short"})
    assert res.status_code == 422


def test_ai_validation_rejects_mode() -> None:
    res = client.post(
        "/api/ai/analyze",
        json={"imageBase64": DUMMY_IMAGE, "mode": "invalid_mode"},
    )
    assert res.status_code == 422
