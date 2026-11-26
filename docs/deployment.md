# Deployment

The AI container installs CPU ONNX Runtime and mounts `/models`; it contains no weights in the
image. For local development, run `powershell -ExecutionPolicy Bypass -File
scripts/provision-face-models.ps1` once before `docker compose up -d --build`. The script downloads
the configured YuNet and AuraFace artifacts into the named Docker volume and verifies pinned checksums.
In production, provision the reviewed artifacts through a controlled artifact system and mount them
read-only. One service process loads models once; scale using separate containers and bounded
inference concurrency.

Before a production release, create a separate environment file with real secrets and public HTTPS
URLs, then run `node scripts/verify-env.mjs --production path/to/production.env`. This check requires
`NODE_ENV=production`, disables Swagger, checks public URL schemes, and checks that application
secrets are distinct and at least 32 characters. It does not verify DNS, certificates, secret
entropy, or external infrastructure. Do not use the repository's local `.env` for production.

Compose runs `prisma migrate deploy` in a one-shot `migrate` service after PostgreSQL is healthy;
the API waits for that service to succeed. Check `docker compose logs migrate` on each release.
Back up the database before migrating, and rehearse restore before launch.

The included Compose file is a local development stack: it publishes PostgreSQL, Redis, storage,
API, and web ports on all host interfaces. For production, restrict private ports at the host or
network layer, expose the web app only through a TLS reverse proxy, use durable encrypted storage
and backups, and provide private API-to-AI networking. Set browser-visible URLs to the actual HTTPS
hostnames. The current local `.env` uses HTTP and development mode and must not be deployed as-is.

Container health uses `/health/live`; application readiness uses `/health/ready`. Missing or incompatible weights keep readiness false. GPU requires a separately reviewed CUDA-compatible image and `FACE_DEVICE=gpu`; verify the reported provider.

Required variables are in `.env.example`: model paths/version/dimension, device, detection/quality limits, concurrency, timeout, retries, and result limits.

When recognition preprocessing or model weights change, assign a new `FACE_MODEL_VERSION` and
reindex existing photos before allowing guest searches. With Compose, preview the migration using
`docker compose exec api node apps/api/scripts/reindex-face-embeddings.cjs`, then queue it with
`docker compose exec api node apps/api/scripts/reindex-face-embeddings.cjs --apply`. Confirm every
active photo is `READY` with the new model version. Searches made with the old version should be
expired so guests cannot use stale results.

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
