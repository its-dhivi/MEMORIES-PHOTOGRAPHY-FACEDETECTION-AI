from concurrent.futures import ThreadPoolExecutor
from time import sleep

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
        assert np.allclose(tensor, (127.0 - 127.5) / 127.5)
        return super().run(outputs, inputs)


class FakeOpenCVSFaceRecognizer:
    def alignCrop(self, image, face_row):
        assert image.shape == (180, 240, 3)
        assert face_row.shape == (1, 15)
        return np.full((112, 112, 3), 127, dtype=np.uint8)

    def feature(self, aligned):
        assert aligned.shape == (112, 112, 3)
        return np.arange(1, 129, dtype=np.float32)[None, :]


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


def test_smaller_embedding_is_zero_padded_without_changing_cosine_geometry() -> None:
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


def test_sface_provider_uses_opencv_alignment_feature_and_versioned_padding() -> None:
    settings = Settings(
        ai_internal_token="a" * 32,
        face_model_provider="sface",
        face_model_name="opencv-sface",
        face_model_version="opencv-sface-2021dec-v1",
        face_preprocessing_version="sface-opencv-aligncrop-112-v1",
        face_recognition_model_path="/missing/sface.onnx",
        face_detection_model_path="/missing/detection.onnx",
        face_recognition_output_dimension=128,
        face_embedding_dimension=512,
    )
    manager = ModelManager(settings)
    manager.recognizer = FakeOpenCVSFaceRecognizer()
    row = np.array(
        [20, 20, 120, 120, 40, 55, 90, 55, 65, 78, 48, 102, 82, 102, 0.99],
        dtype=np.float32,
    )

    aligned = manager._aligned_crop(np.zeros((180, 240, 3), dtype=np.uint8), row)
    embedding = manager._embedding(aligned, np)

    assert embedding.shape == (512,)
    assert np.count_nonzero(embedding[128:]) == 0
    assert abs(float(np.linalg.norm(embedding)) - 1.0) < 1e-6


def test_raw_rgb_mode_remains_available_for_previous_model_versions() -> None:
    class RawRecognizer(FakeRecognizer):
        def run(self, outputs, inputs):
            assert np.all(inputs["input"] == 127.0)
            return super().run(outputs, inputs)

    settings = Settings(
        ai_internal_token="a" * 32,
        face_model_version="previous-v1",
        face_recognition_model_path="/missing/recognition.onnx",
        face_detection_model_path="/missing/detection.onnx",
        face_recognition_input_normalization="none",
    )
    manager = ModelManager(settings)
    manager.recognizer = RawRecognizer()
    manager.input_name = "input"
    manager._embedding(np.full((112, 112, 3), 127, dtype=np.uint8), np)


def test_concurrent_detection_keeps_each_image_size() -> None:
    class Detector:
        size = (0, 0)

        def setInputSize(self, size):
            self.size = size

        def detect(self, image):
            sleep(0.05)
            assert self.size == (image.shape[1], image.shape[0])
            return 0, None

    settings = Settings(
        ai_internal_token="a" * 32,
        face_model_version="test-v1",
        face_recognition_model_path="/missing/recognition.onnx",
        face_detection_model_path="/missing/detection.onnx",
    )
    manager = ModelManager(settings)
    manager.detector = Detector()
    manager.recognizer = FakeRecognizer()
    manager.error = None
    images = [np.zeros((640, 480, 3), dtype=np.uint8), np.zeros((1200, 900, 3), dtype=np.uint8)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(manager.analyze, images))
    assert [result.faces for result in results] == [[], []]


def test_overlapping_tiles_recover_and_deduplicate_a_small_face() -> None:
    class Detector:
        def setInputSize(self, size):
            self.size = size

        def detect(self, image):
            if image.shape[1] != 1280 or image.shape[0] != 1280:
                return 0, None
            points = np.argwhere(image[:, :, 0] == 255)
            if not len(points):
                return 0, None
            y, x = points[0]
            row = np.array(
                [
                    x - 20,
                    y - 20,
                    40,
                    40,
                    x - 9,
                    y - 5,
                    x + 9,
                    y - 5,
                    x,
                    y + 2,
                    x - 7,
                    y + 11,
                    x + 7,
                    y + 11,
                    0.9,
                ],
                dtype=np.float32,
            )
            return 0, row[None, :]

    manager = ModelManager(
        Settings(
            ai_internal_token="a" * 32,
            face_model_version="test-v1",
            face_recognition_model_path="/missing/recognition.onnx",
            face_detection_model_path="/missing/detection.onnx",
        )
    )
    manager.detector = Detector()
    image = np.zeros((2048, 2048, 3), dtype=np.uint8)
    image[1000, 1000] = 255
    rows = manager._detect_rows(image, tiled=True)
    assert len(rows) == 1
    assert abs(float(rows[0][0]) - 980) < 1
    assert abs(float(rows[0][1]) - 980) < 1
