"""Compare app AuraFace embeddings with the documented direct ONNX reference path."""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image_root", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--count", type=int, default=20)
    args = parser.parse_args()
    settings = get_settings()
    manager = ModelManager(settings)
    manager.load()
    if not manager.ready:
        raise SystemExit(f"Application pipeline unavailable: {manager.error}")

    identity_dirs = sorted(
        {p.parent for p in args.image_root.rglob("*") if p.is_file() and p.parent.name.startswith("identity-")},
        key=lambda p: hashlib.sha256(p.parent.name.encode()).digest(),
    )
    files = []
    for directory in identity_dirs:
        images = sorted(p for p in directory.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
        if images:
            files.append(images[0])
        if len(files) >= args.count:
            break
    if len(files) != args.count:
        raise SystemExit(f"Expected {args.count} identity images, found {len(files)}")

    reference = ort.InferenceSession(settings.face_recognition_model_path, providers=["CPUExecutionProvider"])
    input_name = reference.get_inputs()[0].name
    output_rows = []
    for index, path in enumerate(files, 1):
        rgb_image = decode_image(path.read_bytes(), settings)
        bgr = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR)
        detections = manager._detect_rows(bgr, tiled=True)
        if not detections:
            raise RuntimeError(f"No face detected for selected image: {path}")
        row = max(detections, key=lambda item: float(item[-1]))
        aligned_bgr = manager._align(bgr, row[4:14])

        # Application implementation, including its own BGR->RGB transform, normalization and L2.
        app_vector = manager._embedding(aligned_bgr, np).astype(np.float32)

        # Independent documented reference: aligned RGB, (pixel - 127.5)/127.5,
        # NCHW float32, direct ONNX Runtime, then explicit L2 normalization.
        aligned_rgb = cv2.cvtColor(aligned_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
        reference_tensor = ((aligned_rgb - 127.5) / 127.5).transpose(2, 0, 1)[None, ...].copy()
        raw_reference = reference.run(None, {input_name: reference_tensor})[0][0].astype(np.float32)
        ref_norm = float(np.linalg.norm(raw_reference))
        if ref_norm <= 1e-12:
            raise RuntimeError(f"Reference returned a zero vector: {path}")
        ref_vector = raw_reference / ref_norm

        cosine = float(np.dot(app_vector, ref_vector) / (np.linalg.norm(app_vector) * np.linalg.norm(ref_vector)))
        difference = np.abs(app_vector - ref_vector)
        output_rows.append({
            "image": path.relative_to(args.image_root).as_posix(),
            "identity": path.parent.name,
            "cosine_similarity": cosine,
            "max_absolute_difference": float(difference.max()),
            "l2_difference": float(np.linalg.norm(difference)),
            "application_l2_norm": float(np.linalg.norm(app_vector)),
            "reference_l2_norm": float(np.linalg.norm(ref_vector)),
            "raw_reference_l2_norm": ref_norm,
        })
        print(f"Processed {index}/{len(files)}: {path.name} cosine={cosine:.9f} max_abs={difference.max():.3g}", flush=True)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    summary = {
        "model": settings.face_model_version,
        "provider": reference.get_providers(),
        "reference_contract": "aligned RGB 112x112; (pixel-127.5)/127.5; NCHW float32; direct ONNX; L2 normalized",
        "image_count": len(output_rows),
        "mean_cosine_similarity": float(np.mean([r["cosine_similarity"] for r in output_rows])),
        "minimum_cosine_similarity": float(min(r["cosine_similarity"] for r in output_rows)),
        "maximum_absolute_difference": float(max(r["max_absolute_difference"] for r in output_rows)),
        "maximum_l2_difference": float(max(r["l2_difference"] for r in output_rows)),
        "images": output_rows,
    }
    args.output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Saved results: {args.output}", flush=True)


if __name__ == "__main__":
    main()
