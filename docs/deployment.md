# Deployment

The AI container installs CPU ONNX Runtime and mounts `/models`; it contains no weights in the
image. For local development, run `powershell -ExecutionPolicy Bypass -File
scripts/provision-face-models.ps1` once before `docker compose up -d --build`. The script downloads
the configured YuNet and SFace artifacts into the named Docker volume and verifies pinned checksums.
In production, provision the reviewed artifacts through a controlled artifact system and mount them
read-only. One service process loads models once; scale using separate containers and bounded
inference concurrency.

Container health uses `/health/live`; application readiness uses `/health/ready`. Missing or incompatible weights keep readiness false. GPU requires a separately reviewed CUDA-compatible image and `FACE_DEVICE=gpu`; verify the reported provider.

Required variables are in `.env.example`: model paths/version/dimension, device, detection/quality limits, concurrency, timeout, retries, and result limits.

Release checklist:

- Apply the Phase 3 migration and confirm pgvector indexes.
- Verify private storage, Redis, API-to-AI authentication/networking, and graceful shutdown.
- Run real indexing and event-scoped retrieval with licensed weights.
- Calibrate/version thresholds on consented representative data.
- Benchmark target event sizes and inspect query plans.
- Test retries, dead letters, deletion races, withdrawal, expiry, and cross-event denial.
- Complete privacy, security, model-license, load, backup, and restore reviews.

# Phase 4 deployment notes

Set `API_INTERNAL_URL` to the API address reachable from the Next.js server (`http://api:4000/api/v1` in Compose), while `NEXT_PUBLIC_API_URL` remains browser-reachable for the administrator application. Configure `GUEST_ZIP_MAX_PHOTOS` and `GUEST_ZIP_MAX_BYTES` for available worker/storage capacity. Keep originals and derivatives private and ensure the public storage endpoint is HTTPS in production.

Run `prisma migrate deploy` to create `GuestDownloadJob`. Operate at least one API worker with the `guest-downloads` BullMQ processor. Monitor failed ZIP jobs and storage cleanup; do not lengthen the two-minute guest download URL without a privacy review.
