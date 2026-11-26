# AI pipeline

## Model contract and licensing

Model weights are not committed to Git. Local development uses the operator-run
`scripts/provision-face-models.ps1` command to fetch OpenCV Zoo's YuNet detector and SFace
recognizer into the private Docker model volume and verify their pinned SHA-256 checksums. YuNet's
model directory declares MIT licensing and SFace's directory declares Apache-2.0 licensing. A
production operator must still review model licensing, training-data provenance, biometric law, and
fitness for the intended jurisdiction before deployment.

SFace produces a normalized 128-dimensional vector. The AI adapter zero-pads it to the existing
`vector(512)` storage contract; cosine similarity is unchanged by this padding. Every search is also
restricted to the exact model version, event, active guest session, and current consent.

Startup validates model files, CPU/CUDA provider, shapes, output dimension, and a warm-up inference. `/health/live` reports process liveness. `/health/ready` returns 503 until both models load. GPU is never reported unless CUDAExecutionProvider is active.

## Processing

JPEG, PNG, and WebP are signature-decoded with Pillow, EXIF-oriented, byte/pixel bounded, and converted to RGB. YuNet detects all faces. Five landmarks align accepted faces. Blur, exposure, confidence, and minimum size determine quality. Accepted float32 embeddings are finite-checked and L2-normalized.

The BullMQ worker reads the private original, calls the authenticated AI endpoint, transactionally replaces embeddings, updates counts/version/duration, and marks the photo ready. Transient failures retry exponentially; permanent invalid-image failures enter dead-letter state. Valid no-face photos remain successful.

## Matching and calibration

NestJS sends an in-memory selfie to the private endpoint and does not persist it. PostgreSQL cosine search uses `<=>`, constrained by event, model version, accepted quality, ready/non-deleted photos, and configured threshold. `DISTINCT ON (photoId)` keeps the best face per photo.

Similarity is not probability. Calibrate using consented same/different-person pairs and a false-positive-first operating point. Measure false match/non-match rates, precision, recall, subgroup behavior, latency, and throughput. No accuracy metric is claimed.

Use `scripts/benchmark.py` for inference and `benchmark:vector` for populated event indexes. Measure 100, 1,000, 5,000, and 10,000-photo events before capacity claims.

# Phase 4 search integration

The guest UI submits exactly one consented selfie to NestJS through the same-origin BFF. Frontend decoding, type, size, and minimum-dimension checks provide early feedback only; FastAPI remains authoritative for face count, blur, exposure, size, and embedding validation. No selfie or embedding is persisted by the Phase 4 path. Real recognition remains **integration implemented — real recognition verification pending**.
