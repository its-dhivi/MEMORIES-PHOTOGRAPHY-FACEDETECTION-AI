"""Offline, local-only identity retrieval benchmark for labeled face photographs."""

import argparse
import csv
import hashlib
import json
import math
import sys
import time
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np

from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return 0.0
    return sorted(values)[min(len(values) - 1, math.ceil(len(values) * percent) - 1)]


def zip_samples(archive: zipfile.ZipFile, identities: int) -> list[tuple[str, str, str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for name in archive.namelist():
        if not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        identity = next((part for part in name.split("/") if part.startswith("identity-")), None)
        if identity:
            grouped[identity].append(name)
    selected = sorted(
        (identity for identity, images in grouped.items() if len(images) >= 3),
        key=lambda identity: hashlib.sha256(identity.encode()).digest(),
    )[:identities]
    rows = []
    for number, identity in enumerate(selected):
        split = "calibration" if number % 2 == 0 else "evaluation"
        for name in sorted(grouped[identity])[:3]:
            rows.append((name, identity, split))
    return rows


def score(rows: list[dict[str, object]], threshold: float) -> dict[str, object]:
    detected = sum(bool(row["detected"]) for row in rows)
    accepted = [row for row in rows if row["embedding"] is not None]
    true_positive = false_positive = true_negative = false_negative = 0
    for index, first in enumerate(rows):
        for second in rows[index + 1 :]:
            same = first["identity"] == second["identity"]
            if first["embedding"] is None or second["embedding"] is None:
                matched = False
            else:
                matched = float(np.dot(first["embedding"], second["embedding"])) >= threshold
            if same and matched:
                true_positive += 1
            elif same:
                false_negative += 1
            elif matched:
                false_positive += 1
            else:
                true_negative += 1
    precision = (
        true_positive / (true_positive + false_positive) if true_positive + false_positive else 0
    )
    recall = (
        true_positive / (true_positive + false_negative) if true_positive + false_negative else 0
    )
    timings = [float(row["seconds"]) for row in rows]
    cpu_times = [float(row["cpu_seconds"]) for row in rows]
    retrieval_tp = retrieval_fp = retrieval_fn = 0
    search_times: list[float] = []
    by_identity: dict[object, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_identity[row["identity"]].append(row)
    queries = [photos[0] for photos in by_identity.values()]
    gallery = [photo for photos in by_identity.values() for photo in photos[1:]]
    for query in queries:
        start = time.perf_counter()
        for photo in gallery:
            expected = photo["identity"] == query["identity"]
            matched = (
                query["embedding"] is not None
                and photo["embedding"] is not None
                and float(np.dot(query["embedding"], photo["embedding"])) >= threshold
            )
            if matched and expected:
                retrieval_tp += 1
            elif matched:
                retrieval_fp += 1
            elif expected:
                retrieval_fn += 1
        search_times.append(time.perf_counter() - start)
    return {
        "images": len(rows),
        "identities": len({row["identity"] for row in rows}),
        "detected_images": detected,
        "accepted_images": len(accepted),
        "detection_image_recall_proxy": detected / len(rows) if rows else 0,
        "true_positive_pairs": true_positive,
        "false_positive_pairs": false_positive,
        "true_negative_pairs": true_negative,
        "false_negative_pairs": false_negative,
        "pair_precision": precision,
        "pair_recall": recall,
        "false_acceptance_rate": false_positive / (false_positive + true_negative)
        if false_positive + true_negative
        else 0,
        "false_rejection_rate": false_negative / (true_positive + false_negative)
        if true_positive + false_negative
        else 0,
        "mean_inference_seconds": sum(timings) / len(timings) if timings else 0,
        "p95_inference_seconds": percentile(timings, 0.95),
        "mean_cpu_seconds_per_image": sum(cpu_times) / len(cpu_times) if cpu_times else 0,
        "photo_retrieval_true_positive": retrieval_tp,
        "photo_retrieval_false_positive": retrieval_fp,
        "photo_retrieval_false_negative": retrieval_fn,
        "photo_retrieval_precision": retrieval_tp / (retrieval_tp + retrieval_fp)
        if retrieval_tp + retrieval_fp
        else 0,
        "photo_retrieval_recall": retrieval_tp / (retrieval_tp + retrieval_fn)
        if retrieval_tp + retrieval_fn
        else 0,
        "mean_in_memory_search_seconds": sum(search_times) / len(search_times)
        if search_times
        else 0,
        "p95_in_memory_search_seconds": percentile(search_times, 0.95),
    }


def pair_scores(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    pairs = []
    for split in ("calibration", "evaluation"):
        subset = [row for row in rows if row["split"] == split]
        for index, first in enumerate(subset):
            for second in subset[index + 1 :]:
                pairs.append(
                    {
                        "split": split,
                        "same": first["identity"] == second["identity"],
                        "score": float(np.dot(first["embedding"], second["embedding"]))
                        if first["embedding"] is not None and second["embedding"] is not None
                        else None,
                    }
                )
    return pairs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="ControlFace10K ZIP or a local CSV manifest")
    parser.add_argument("--identities", type=int, default=100)
    parser.add_argument("--threshold", type=float, default=0.64)
    parser.add_argument("--pairs-output", type=Path)
    args = parser.parse_args()
    settings = get_settings()
    manager = ModelManager(settings)
    manager.load()
    if not manager.ready:
        raise SystemExit(f"Model unavailable: {manager.error}")
    archive = zipfile.ZipFile(args.source) if args.source.suffix.lower() == ".zip" else None
    if archive:
        samples = zip_samples(archive, args.identities)
        read = archive.read
        source_type = "ControlFace10K synthetic identity ZIP"
    else:
        with args.source.open(newline="", encoding="utf-8") as source:
            samples = [
                (row["image_path"], row["person_id"], row["split"])
                for row in csv.DictReader(source)
            ]

        def read(name: str) -> bytes:
            return Path(name).read_bytes()

        source_type = "local labeled manifest"
    if not samples:
        raise SystemExit("No labeled images found")
    rows: list[dict[str, object]] = []
    for number, (path, identity, split) in enumerate(samples, 1):
        rgb = decode_image(read(path), settings)
        start = time.perf_counter()
        cpu_start = time.process_time()
        try:
            analysis = manager.analyze(rgb, tiled=True)
        except TypeError as exc:
            if "tiled" not in str(exc):
                raise
            analysis = manager.analyze(rgb)  # baseline image predates tiled detection
        seconds = time.perf_counter() - start
        cpu_seconds = time.process_time() - cpu_start
        accepted = [face for face in analysis.faces if face.embedding is not None]
        rows.append(
            {
                "identity": identity,
                "split": split,
                "detected": bool(analysis.faces),
                "embedding": np.asarray(accepted[0].embedding, dtype=np.float32)
                if len(accepted) == 1
                else None,
                "seconds": seconds,
                "cpu_seconds": cpu_seconds,
            }
        )
        if number % 25 == 0:
            print(f"Processed {number}/{len(samples)} images", file=sys.stderr)
    report = {
        "source": source_type,
        "model_version": settings.face_model_version,
        "threshold": args.threshold,
        "peak_rss_mib": peak_rss_mib(),
        "calibration": score(
            [row for row in rows if row["split"] == "calibration"], args.threshold
        ),
        "evaluation": score([row for row in rows if row["split"] == "evaluation"], args.threshold),
        "limitations": [
            "Single-subject labels provide an image-level detection proxy, not box recall.",
            "Pair scores do not measure group retrieval, pgvector recall, or end-to-end latency.",
            "Synthetic identities are not representative of wedding guests or DSLR photographs.",
        ],
    }
    if args.pairs_output:
        args.pairs_output.write_text(json.dumps(pair_scores(rows)), encoding="utf-8")
    print(json.dumps(report, indent=2))


def peak_rss_mib() -> float | None:
    try:
        import resource

        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    except ImportError:
        return None


if __name__ == "__main__":
    main()
