from pathlib import Path
from threading import Lock
from typing import Any

from .config import Settings
from .schemas import AnalysisResponse, BoundingBox, FaceAnalysis


class ModelManager:
    """Operator-supplied YuNet detector and versioned recognition provider lifecycle."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._detector_lock = Lock()
        self._recognizer_lock = Lock()
        self.detector: Any | None = None
        self.recognizer: Any | None = None
        self.input_name = ""
        self.input_height = 0
        self.input_width = 0
        self.providers: list[str] = []
        self.error: str | None = "Models have not been loaded"

    @property
    def ready(self) -> bool:
        return self.detector is not None and self.recognizer is not None and self.error is None

    def load(self) -> None:
        detector_path = Path(self.settings.face_detection_model_path)
        recognizer_path = Path(self.settings.face_recognition_model_path)
        if not detector_path.is_file() or not recognizer_path.is_file():
            self.error = "Configured model files are missing"
            return
        try:
            import cv2
            import numpy as np
            import onnxruntime as ort  # type: ignore[import-untyped]

            self.detector = cv2.FaceDetectorYN.create(
                str(detector_path),
                "",
                (self.settings.face_detection_input_size, self.settings.face_detection_input_size),
                self.settings.face_detection_threshold,
                0.3,
                5000,
            )
            if self.settings.face_model_provider == "sface":
                if self.settings.face_device != "cpu":
                    raise RuntimeError("SFace provider is configured for CPU inference only")
                if self.settings.face_recognition_output_dimension != 128:
                    raise RuntimeError("SFace recognition output dimension must be 128")
                if self.settings.face_embedding_dimension < 128:
                    raise RuntimeError("SFace storage dimension must be at least 128")
                self.recognizer = cv2.FaceRecognizerSF.create(str(recognizer_path), "")
                self.input_name = "opencv-sface-feature"
                self.input_height = self.input_width = 112
                self.providers = ["OpenCV-DNN-CPU"]
                sface_warmup = np.zeros((112, 112, 3), dtype=np.uint8)
                result = self.recognizer.feature(sface_warmup)
                if result.reshape(-1).shape[0] != 128:
                    raise RuntimeError("SFace warmup returned an invalid embedding")
            else:
                available = ort.get_available_providers()
                providers = (
                    ["CUDAExecutionProvider", "CPUExecutionProvider"]
                    if self.settings.face_device == "gpu"
                    else ["CPUExecutionProvider"]
                )
                if self.settings.face_device == "gpu" and "CUDAExecutionProvider" not in available:
                    raise RuntimeError("CUDA execution provider was requested but is unavailable")
                session_options = ort.SessionOptions()
                session_options.log_severity_level = 3
                self.recognizer = ort.InferenceSession(
                    str(recognizer_path), sess_options=session_options, providers=providers
                )
                self.providers = self.recognizer.get_providers()
                inputs, outputs = self.recognizer.get_inputs(), self.recognizer.get_outputs()
                if len(inputs) != 1 or not outputs:
                    raise RuntimeError(
                        "Recognition model must have one input and at least one output"
                    )
                shape = inputs[0].shape
                if (
                    len(shape) != 4
                    or not isinstance(shape[2], int)
                    or not isinstance(shape[3], int)
                ):
                    raise RuntimeError("Recognition model input must have fixed NCHW dimensions")
                if outputs[0].shape[-1] != self.settings.face_recognition_output_dimension:
                    raise RuntimeError("Recognition output dimension does not match configuration")
                self.input_name = inputs[0].name
                self.input_height, self.input_width = shape[2], shape[3]
                onnx_warmup = np.zeros(
                    (1, 3, self.input_height, self.input_width), dtype=np.float32
                )
                result = self.recognizer.run(None, {self.input_name: onnx_warmup})[0]
                if result.shape[-1] != self.settings.face_recognition_output_dimension:
                    raise RuntimeError("Recognition warmup returned an invalid embedding")
            self.error = None
        except Exception as exc:
            self.detector = None
            self.recognizer = None
            self.error = str(exc)[:300]

    def analyze(
        self, rgb: Any, *, tiled: bool = False, include_diagnostics: bool = False
    ) -> AnalysisResponse:
        import base64

        if not self.ready:
            raise RuntimeError(self.error or "Models unavailable")
        import cv2
        import numpy as np

        height, width = rgb.shape[:2]
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        detections = self._detect_rows(bgr, tiled=tiled)
        faces: list[FaceAnalysis] = []
        if detections:
            for row in sorted(detections, key=lambda item: (float(item[1]), float(item[0]))):
                x, y, box_width, box_height = [int(round(float(value))) for value in row[:4]]
                x, y = max(0, x), max(0, y)
                box_width, box_height = min(box_width, width - x), min(box_height, height - y)
                confidence = float(row[-1])
                crop = bgr[y : y + box_height, x : x + box_width]
                quality_score, quality_status = self._quality(
                    crop, confidence, box_width, box_height
                )
                embedding = None
                aligned = None
                if quality_status == "ACCEPTED":
                    aligned = self._aligned_crop(bgr, row)
                    embedding = self._embedding(aligned, np).tolist()
                if include_diagnostics and aligned is None:
                    aligned = self._aligned_crop(bgr, row)
                preview = None
                if include_diagnostics and aligned is not None:
                    encoded, jpeg = cv2.imencode(".jpg", aligned, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if encoded:
                        preview = "data:image/jpeg;base64," + base64.b64encode(
                            jpeg.tobytes()
                        ).decode("ascii")
                faces.append(
                    FaceAnalysis(
                        bounding_box=BoundingBox(x=x, y=y, width=box_width, height=box_height),
                        detection_confidence=confidence,
                        quality_score=quality_score,
                        quality_status=quality_status,
                        embedding=embedding,
                        landmarks=np.asarray(row[4:14]).reshape(5, 2).tolist()
                        if include_diagnostics
                        else None,
                        aligned_preview=preview,
                    )
                )
        return AnalysisResponse(
            model_name=self.settings.face_model_name,
            model_version=self.settings.face_model_version,
            preprocessing_version=self.settings.face_preprocessing_version,
            detection_pipeline_version=self.settings.face_detection_pipeline_version,
            embedding_dimension=self.settings.face_embedding_dimension,
            width=width,
            height=height,
            faces=faces,
        )

    def _detect_rows(self, bgr: Any, *, tiled: bool) -> list[Any]:
        import cv2
        import numpy as np

        detector = self.detector
        if detector is None:
            raise RuntimeError("Detection model is unavailable")
        height, width = bgr.shape[:2]

        def detect(image: Any, left: int = 0, top: int = 0, scale: float = 1.0) -> list[Any]:
            # YuNet stores input size on the shared instance. Keep resizing and
            # inference together under the lock across concurrent requests.
            with self._detector_lock:
                detector.setInputSize((image.shape[1], image.shape[0]))
                _, found = detector.detect(image)
            if found is None:
                return []
            rows = []
            for item in found:
                row = np.asarray(item, dtype=np.float32).copy()
                row[[0, 2, 4, 6, 8, 10, 12]] *= scale
                row[[1, 3, 5, 7, 9, 11, 13]] *= scale
                row[[0, 4, 6, 8, 10, 12]] += left
                row[[1, 5, 7, 9, 11, 13]] += top
                rows.append(row)
            return rows

        max_side = self.settings.face_detection_global_max_side
        if tiled and max(width, height) > max_side:
            scale = max(width, height) / max_side
            global_image = cv2.resize(
                bgr, (round(width / scale), round(height / scale)), interpolation=cv2.INTER_AREA
            )
            candidates = detect(global_image, scale=scale)
        else:
            candidates = detect(bgr)

        if tiled and max(width, height) > max_side:
            tile = self.settings.face_detection_tile_size
            step = max(1, tile * 4 // 5)

            def positions(length: int) -> list[int]:
                if length <= tile:
                    return [0]
                return sorted(set(range(0, length - tile + 1, step)) | {length - tile})

            windows = [(x, y) for y in positions(height) for x in positions(width)]
            if len(windows) > self.settings.face_detection_max_tiles:
                raise RuntimeError("Image requires more detection tiles than configured")
            for x, y in windows:
                candidates.extend(detect(bgr[y : y + tile, x : x + tile], x, y))

        # The global pass and overlapping tiles can report the same face. Keep
        # the highest-confidence box and its landmarks for alignment.
        kept: list[Any] = []
        for row in sorted(candidates, key=lambda item: float(item[-1]), reverse=True):
            box_x, box_y, box_w, box_h = [float(value) for value in row[:4]]
            duplicate = False
            for previous in kept:
                px, py, pw, ph = [float(value) for value in previous[:4]]
                overlap = max(0.0, min(box_x + box_w, px + pw) - max(box_x, px)) * max(
                    0.0, min(box_y + box_h, py + ph) - max(box_y, py)
                )
                union = box_w * box_h + pw * ph - overlap
                if union > 0 and overlap / union >= 0.4:
                    duplicate = True
                    break
            if not duplicate:
                kept.append(row)
        return kept

    def _quality(self, crop: Any, confidence: float, width: int, height: int) -> tuple[float, str]:
        import cv2
        import numpy as np

        if crop.size == 0 or min(width, height) < self.settings.face_min_size_pixels:
            return 0.0, "FACE_TOO_SMALL"
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        blur, exposure = float(cv2.Laplacian(gray, cv2.CV_64F).var()), float(np.mean(gray))
        if blur < self.settings.face_min_blur_variance:
            return min(1.0, blur / self.settings.face_min_blur_variance), "TOO_BLURRY"
        if exposure < self.settings.face_min_exposure:
            return exposure / self.settings.face_min_exposure, "TOO_DARK"
        if exposure > self.settings.face_max_exposure:
            return max(
                0.0, (255.0 - exposure) / (255.0 - self.settings.face_max_exposure)
            ), "TOO_BRIGHT"
        return min(1.0, confidence * min(1.0, blur / 100.0)), "ACCEPTED"

    def _align(self, bgr: Any, landmarks: Any) -> Any:
        import cv2
        import numpy as np

        source = np.asarray(landmarks, dtype=np.float32).reshape(5, 2)
        template = np.array(
            [
                [38.2946, 51.6963],
                [73.5318, 51.5014],
                [56.0252, 71.7366],
                [41.5493, 92.3655],
                [70.7299, 92.2041],
            ],
            dtype=np.float32,
        )
        template[:, 0] *= self.input_width / 112.0
        template[:, 1] *= self.input_height / 112.0
        matrix, _ = cv2.estimateAffinePartial2D(source, template, method=cv2.LMEDS)
        if matrix is None:
            raise RuntimeError("Face alignment failed")
        return cv2.warpAffine(bgr, matrix, (self.input_width, self.input_height))

    def _aligned_crop(self, bgr: Any, row: Any) -> Any:
        if self.settings.face_model_provider == "sface":
            recognizer = self.recognizer
            if recognizer is None:
                raise RuntimeError("SFace model is unavailable")
            with self._recognizer_lock:
                return recognizer.alignCrop(bgr, row.reshape(1, -1))
        return self._align(bgr, row[4:14])

    def _embedding(self, aligned: Any, np: Any) -> Any:
        recognizer = self.recognizer
        if recognizer is None:
            raise RuntimeError("Recognition model is unavailable")
        if self.settings.face_model_provider == "sface":
            with self._recognizer_lock:
                vector = recognizer.feature(aligned).reshape(-1).astype(np.float32)
        else:
            rgb = aligned[:, :, ::-1].astype(np.float32)
            if self.settings.face_recognition_input_normalization == "minus_one_one":
                rgb = (rgb - 127.5) / 127.5
            tensor = rgb.transpose(2, 0, 1)[None, ...]
            vector = recognizer.run(None, {self.input_name: tensor})[0][0].astype(np.float32)
        if (
            vector.shape[0] != self.settings.face_recognition_output_dimension
            or not np.isfinite(vector).all()
        ):
            raise RuntimeError("Recognition produced an invalid embedding")
        norm = float(np.linalg.norm(vector))
        if norm <= 1e-12:
            raise RuntimeError("Recognition produced a zero embedding")
        normalized = vector / norm
        storage_dimension = self.settings.face_embedding_dimension
        if normalized.shape[0] > storage_dimension:
            raise RuntimeError("Recognition output exceeds the configured storage dimension")
        if normalized.shape[0] < storage_dimension:
            # Zero-padding preserves cosine similarity exactly while allowing a
            # 128-dimensional SFace model to use the existing pgvector(512)
            # contract. Model-version filtering prevents cross-model searches.
            normalized = np.pad(normalized, (0, storage_dimension - normalized.shape[0]))
        return normalized
