import argparse
import statistics
import time
from pathlib import Path

from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager


def main() -> None:
    parser = argparse.ArgumentParser(description="Local face inference latency benchmark")
    parser.add_argument("images", type=Path, nargs="+")
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    settings = get_settings()
    manager = ModelManager(settings)
    manager.load()
    if not manager.ready:
        raise SystemExit(f"Models unavailable: {manager.error}")
    timings: list[float] = []
    face_count = 0
    for _ in range(args.runs):
        for path in args.images:
            image = decode_image(path.read_bytes(), settings)
            started = time.perf_counter()
            result = manager.analyze(image)
            timings.append((time.perf_counter() - started) * 1000)
            face_count += len(result.faces)
    p95 = sorted(timings)[max(0, int(len(timings) * 0.95) - 1)]
    print(
        {
            "runs": len(timings),
            "faces": face_count,
            "mean_ms": statistics.mean(timings),
            "p95_ms": p95,
        }
    )


if __name__ == "__main__":
    main()
