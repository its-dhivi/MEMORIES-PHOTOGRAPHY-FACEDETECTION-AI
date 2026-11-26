import numpy as np

from app.config import Settings
from app.model_manager import ModelManager


class FakeRecognizer:
    def run(self, _outputs, _inputs):
        vector = np.arange(1, 513, dtype=np.float32)[None, :]
        return [vector]


class FakeSFaceRecognizer:
    def run(self, _outputs, _inputs):
        vector = np.arange(1, 129, dtype=np.float32)[None, :]
        return [vector]


class CapturingRecognizer(FakeSFaceRecognizer):
    def run(self, outputs, inputs):
        tensor = inputs["input"]
        assert tensor.shape == (1, 3, 112, 112)
        assert tensor.dtype == np.float32
        assert np.all(tensor == 127.0)
        return super().run(outputs, inputs)


def test_embedding_is_finite_normalized_and_deterministic() -> None:
    settings = Settings(
        ai_internal_token="a" * 32,
        face_model_version="test-v1",
        face_recognition_model_path="/missing/recognition.onnx",
        face_detection_model_path="/missing/detection.onnx",
    )
    manager = ModelManager(settings)
    manager.recognizer = FakeRecognizer()
    manager.input_name = "input"
    aligned = np.full((112, 112, 3), 127, dtype=np.uint8)
    first = manager._embedding(aligned, np)
    second = manager._embedding(aligned, np)
    assert first.shape == (512,)
    assert np.isfinite(first).all()
    assert abs(float(np.linalg.norm(first)) - 1.0) < 1e-6
    assert np.allclose(first, second)


def test_sface_embedding_is_zero_padded_without_changing_cosine_geometry() -> None:
    settings = Settings(
        ai_internal_token="a" * 32,
        face_model_version="opencv-sface-2021dec-v1",
        face_recognition_model_path="/missing/recognition.onnx",
        face_detection_model_path="/missing/detection.onnx",
        face_recognition_output_dimension=128,
        face_embedding_dimension=512,
    )
    manager = ModelManager(settings)
    manager.recognizer = CapturingRecognizer()
    manager.input_name = "input"
    aligned = np.full((112, 112, 3), 127, dtype=np.uint8)

    embedding = manager._embedding(aligned, np)

    assert embedding.shape == (512,)
    assert np.count_nonzero(embedding[128:]) == 0
    assert abs(float(np.linalg.norm(embedding)) - 1.0) < 1e-6
