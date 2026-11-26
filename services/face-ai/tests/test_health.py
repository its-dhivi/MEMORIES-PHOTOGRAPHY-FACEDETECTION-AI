import os

os.environ.setdefault("AI_INTERNAL_TOKEN", "test-token-with-at-least-thirty-two-characters")
os.environ.setdefault("FACE_MODEL_VERSION", "test-v1")
os.environ.setdefault("FACE_RECOGNITION_MODEL_PATH", "/missing/recognition.onnx")
os.environ.setdefault("FACE_DETECTION_MODEL_PATH", "/missing/detection.onnx")
from fastapi.testclient import TestClient

from app.main import app


def test_health_does_not_claim_model_is_loaded() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["model_loaded"] is False


def test_internal_endpoint_requires_service_token() -> None:
    response = TestClient(app).post(
        "/internal/v1/faces/analyze", files={"file": ("face.jpg", b"invalid", "image/jpeg")}
    )
    assert response.status_code == 401


def test_readiness_does_not_claim_missing_models() -> None:
    with TestClient(app) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["detail"]["ready"] is False
