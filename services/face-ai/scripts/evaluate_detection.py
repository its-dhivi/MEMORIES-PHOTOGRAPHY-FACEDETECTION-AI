"""Evaluate YuNet box recall on locally supplied, consented group photographs.

Manifest JSON: [{"image": "relative/photo.jpg", "boxes": [[x,y,width,height], ...]}].
All boxes are in EXIF-oriented original-image coordinates. No images leave this machine.
"""

import argparse
import json
import math
import time
from pathlib import Path

from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager


def iou(first: list[float], second: list[float]) -> float:
    x, y, w, h = first
    other_x, other_y, other_w, other_h = second
    intersection = max(0.0, min(x + w, other_x + other_w) - max(x, other_x)) * max(
        0.0, min(y + h, other_y + other_h) - max(y, other_y)
    )
    union = w * h + other_w * other_h - intersection
    return intersection / union if union > 0 else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--image-root", type=Path, required=True)
    parser.add_argument("--iou", type=float, default=0.5)
    args = parser.parse_args()
    if not 0 < args.iou <= 1:
        parser.error("--iou must be in (0,1]")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if not isinstance(manifest, list) or not manifest:
        parser.error("manifest must be a non-empty JSON array")
    root = args.image_root.resolve()
    settings = get_settings()
    manager = ModelManager(settings)
    manager.load()
    if not manager.ready:
        raise RuntimeError(manager.error or "Face models are unavailable")
    count = true_positive = false_positive = false_negative = 0
    seconds: list[float] = []
    for item in manifest:
        path = (root / item["image"]).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Image is unavailable within image root: {item['image']}")
        truth = item["boxes"]
        if not isinstance(truth, list) or any(len(box) != 4 for box in truth):
            raise ValueError(f"Invalid boxes for {item['image']}")
        image = decode_image(path.read_bytes(), settings)
        started = time.perf_counter()
        detections = manager._detect_rows(image[:, :, ::-1].copy(), tiled=True)
        seconds.append(time.perf_counter() - started)
        predictions = [[float(value) for value in row[:4]] for row in detections]
        pairs = sorted(
            (
                (iou([float(value) for value in box], prediction), truth_index, prediction_index)
                for truth_index, box in enumerate(truth)
                for prediction_index, prediction in enumerate(predictions)
            ),
            reverse=True,
        )
        matched_truth: set[int] = set()
        matched_predictions: set[int] = set()
        for overlap, truth_index, prediction_index in pairs:
            if overlap < args.iou:
                break
            if truth_index not in matched_truth and prediction_index not in matched_predictions:
                matched_truth.add(truth_index)
                matched_predictions.add(prediction_index)
        count += 1
        true_positive += len(matched_truth)
        false_negative += len(truth) - len(matched_truth)
        false_positive += len(predictions) - len(matched_predictions)
    ordered = sorted(seconds)
    report = {
        "images": count,
        "ground_truth_faces": true_positive + false_negative,
        "detected_faces": true_positive + false_positive,
        "true_positive_boxes": true_positive,
        "false_positive_boxes": false_positive,
        "false_negative_boxes": false_negative,
        "box_recall": true_positive / (true_positive + false_negative)
        if true_positive + false_negative
        else None,
        "box_precision": true_positive / (true_positive + false_positive)
        if true_positive + false_positive
        else None,
        "mean_detection_seconds": sum(seconds) / count,
        "p95_detection_seconds": ordered[math.ceil(count * 0.95) - 1],
        "iou_threshold": args.iou,
        "detection_pipeline_version": settings.face_detection_pipeline_version,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
