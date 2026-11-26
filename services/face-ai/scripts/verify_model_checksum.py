"""Verify the pinned upstream SFace artifact before candidate use."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

SFACEMODEL_SHA256 = "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"
SFACEMODEL_SIZE = 38_696_353


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as model:
        for block in iter(lambda: model.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    args = parser.parse_args()
    if not args.model.is_file():
        raise SystemExit(f"Model file not found: {args.model}")
    actual_size = args.model.stat().st_size
    actual_hash = sha256(args.model)
    if actual_size != SFACEMODEL_SIZE or actual_hash != SFACEMODEL_SHA256:
        raise SystemExit(f"SFace artifact mismatch: size={actual_size}, sha256={actual_hash}")
    print(f"Verified OpenCV Zoo SFace 2021dec: sha256={actual_hash}, bytes={actual_size}")


if __name__ == "__main__":
    main()
