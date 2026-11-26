from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image

from app.config import Settings
from app.image_processor import decode_image
from app.model_manager import ModelManager


def settings() -> Settings:
    return Settings(
        ai_internal_token="a" * 32,
        face_model_version="test-v1",
        face_recognition_model_path="/missing/recognition.onnx",
        face_detection_model_path="/missing/detection.onnx",
    )


def test_corrupted_image_is_rejected() -> None:
    with pytest.raises(HTTPException) as error:
        decode_image(b"not-an-image", settings())
    assert error.value.status_code == 422


def test_unsupported_actual_format_is_rejected() -> None:
    buffer = BytesIO()
    Image.new("RGB", (20, 20)).save(buffer, format="GIF")
    with pytest.raises(HTTPException) as error:
        decode_image(buffer.getvalue(), settings())
    assert error.value.status_code == 415


def test_missing_models_never_report_ready() -> None:
    manager = ModelManager(settings())
    manager.load()
    assert manager.ready is False
    assert manager.error == "Configured model files are missing"
