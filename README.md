# Memories Photography — AI Photo Finder

A privacy-focused event photography platform for private event uploads, asynchronous face indexing, and consented event-scoped selfie matching.

> Status: **The complete local guest search pipeline is implemented.** The premium guest journey,
> HttpOnly BFF session, PIN and consent flow, camera/upload UI, event-scoped SFace search, secure
> result gallery, authorized downloads, and bounded queue-backed ZIP exports are integrated. Model
> artifacts remain outside Git and require the provisioning command below. Production deployment
> still requires legal review and accuracy calibration with representative consented data.

## Phase 4.6 interface

The light-first editorial design separates the photographer workspace, guest album journey, and
touch-oriented `/booth/:slug` kiosk. The kiosk explicitly withdraws consent and clears local state
before returning to its welcome screen. See `docs/design-system.md` and
`docs/phase46-ux-audit.md`.

## Phase 4.7 professional import

Photographers can import JPEG, PNG, WebP, and common DSLR RAW originals up to 500 MiB using
resumable, checksum-verified multipart uploads directly to private S3-compatible storage. Folder
selection is supported where the browser exposes it; the product never claims automatic SD-card
detection. Originals remain immutable while bounded thumbnail, preview, and AI-input derivatives
are generated asynchronously. Guests can select authorized matches and request a private,
queue-backed ZIP without exposing storage object keys. See
`docs/phase47-professional-import.md`, `docs/phase47-storage-architecture.md`, and
`docs/phase47-bulk-download.md`.

## Architecture

- `apps/web`: Next.js dashboard and processing visibility
- `apps/api`: NestJS authorization, queues, AI client, pgvector persistence/search, and result grants
- `services/face-ai`: private FastAPI service using OpenCV YuNet-compatible detection and an operator-supplied ONNX recognizer
- PostgreSQL/pgvector, Redis/BullMQ, and private S3-compatible storage

See [architecture](docs/architecture.md), [AI pipeline](docs/ai-pipeline.md), and [security](docs/security.md).

## Local setup

Requirements: Node.js 22, pnpm 10, Docker Compose v2, and Python 3.11/3.12.

1. Copy `.env.example` to `.env` and replace secrets.
2. Run `powershell -ExecutionPolicy Bypass -File scripts/provision-face-models.ps1` to provision and
   checksum-verify the local YuNet and SFace models. Review their licenses before production use.
3. Run `pnpm install`, `pnpm db:generate`, and `pnpm db:migrate`.
4. Run `docker compose up --build`.
5. Confirm `/health/live` and then `/health/ready`; readiness must report the configured model.
6. Calibrate each event/model threshold with representative, consented data before enabling access.

## Validation

Node: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

Python: create a 3.11/3.12 environment, install `.[ai,test]`, then run `pytest`, `ruff check .`, and `mypy app`.

Benchmarks:

- `python scripts/benchmark.py <licensed test images...>`
- `pnpm --filter @memories/api benchmark:vector <event-uuid> [runs]`
- `node scripts/smoke-test-multipart-upload.mjs` (set `UPLOAD_TEST_BYTES=524288000` for the 500 MiB path)
- `node scripts/smoke-test-face-matching.mjs`

## Limitations

- Weights are downloaded into a local Docker volume, never committed to the repository or included
  in application images.
- A real same-image match is a pipeline smoke test, not an accuracy or production-readiness claim.
- Similarity is a model score, not identity probability. The existing 0.62 database default is only a migration default and must not be treated as calibrated.
- Guest routes are `/e/:slug`, `/access`, `/selfie`, `/searching`, `/results`, and `/privacy`. The Next.js BFF keeps the opaque guest token in a Secure/HttpOnly/SameSite cookie; only non-secret search IDs use per-tab session storage.
- Individual and ZIP downloads are checked against the active session, current consent, owned unexpired search, event settings, and non-deleted photos. ZIP objects expire and cleanup runs every 15 minutes.
- Production recognition remains subject to model-license review, privacy review, and threshold
  calibration using consented representative evaluation data.
