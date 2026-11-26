# Master completion report

Updated: 2026-11-27

## Follow-up implementation: remove event-level approval

The event dashboard now has an Enable Face Matching switch and configurable similarity threshold (default 0.64). The signed JSON upload and event approval/revoke endpoints are removed. Authenticated owners/admins can perform private, event-scoped selfie searches with per-request consent; the selfie is processed in memory, no guest search row is created, and only non-biometric result metadata is audited. Disabling event guest matching expires active event searches and download jobs. Public guest searches require both event enablement and separate system-level `PUBLIC_FACE_MATCHING_MODEL_VALIDATED` plus `PUBLIC_FACE_MATCHING_ENABLED` flags; both default false and model version compatibility is checked at runtime. Legacy event approval columns and values remain in the database for compatibility but are no longer read or exposed by the settings API. The additive migration defaults existing events to disabled without changing event/photo records.

**Change verification:** API tests passed (14 suites / 31 tests); API lint passed; all workspace TypeScript typechecks passed; web tests passed (3 files / 5 tests); web lint passed (0 errors, 17 existing warnings). A production-image Playwright test passed (1/1) for the toggle, threshold update, private consent form, and private result display. Docker production-mode API/web/face-AI images built; the isolated web image returned HTTP 200. A fresh isolated PostgreSQL applied all 10 migrations. Production Compose syntax passed with temporary test-only interpolation values. `docker info` reported Engine 29.9.3; `docker compose ps` showed the same six existing local services active (five healthy); no active service was restarted and no active volume/database/photo was modified.

**External verification blockers:** the accessible local Compose database has two non-deleted events and no exact “Projection Corporate Event” title. No consented reference selfie was available, so the requested live private search on that event was not run. No `.env.production`, production host/domain/TLS configuration, or deployment credentials are present; images were built but not deployed. The active stack is the development Compose configuration, not a configured production deployment. Use `scripts/smoke-test-face-matching.mjs` with an authorized administrator and a consented selfie when the target event/data are available. Public matching stays disabled pending real-world system-level validation.

## Outcome

The earlier completion added a provisional, source-verified SFace decision record; gallery-level manual-label evaluation; an SFace CPU provider; production Compose; and operations documentation. This follow-up removes event-level evaluation signing and approval from the workflow. The additive database change preserves event, photograph, and legacy approval records.

**Technical deployment readiness: not verified; images built, production deployment target unavailable. Commercial launch readiness: blocked. Public guest face matching: disabled pending system-level model validation.**

## Completed and verified work

- SFace 2021dec provenance, model-directory Apache-2.0 grant, artifact size/checksum, input/alignment, output dimensions, CPU support, and limits are recorded in `RECOGNITION-MODEL-DECISION.md`. The file in the persistent model volume verified against SHA-256 `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79` at 38,696,353 bytes. An isolated current face-AI image loaded the SFace `ModelManager` with OpenCV-DNN-CPU and the 128-dimensional vector / 512-dimensional storage configuration. Weight licensing does not settle training-data provenance or biometric/privacy requirements.
- The offline gallery evaluator requires manually assigned identity labels and independent event splits. It reports photo precision/recall, query-level false acceptance/rejection, uncertainty, zero-result searches, incorrect photos exposed, and capture-tag rates. Group-photo detection metrics remain available through the existing manually labeled box evaluator.
- The former event-level HMAC evaluation approval path was removed. Owners/admins can privately match within an authorized event. Public guest matching requires system-level model validation and an independent event toggle; both system flags default false. Runtime model/preprocessing version and event isolation checks remain enforced.
- Added OpenCV SFace CPU inference, OpenCV alignment/features, 128-dimensional output validation, padded storage shape, unique model/preprocessing tags, and checksum verification script. Queries remain filtered by event and compatible model/preprocessing version.
- Added `docker-compose.production.yml`, a TLS reverse proxy for the app and signed S3 upload endpoint, restricted public port bindings, Redis authentication, resource/log/restart/health settings, persistent host paths, and separate service environment exposure. No DB, Redis, RustFS console, API, web, or AI port is host-published in the production override.
- Validated the rendered production Nginx template with `nginx -t` on Nginx 1.28.3 and a disposable self-signed certificate. Replaced the deprecated HTTP/2 listen syntax; the final validation passed without warnings.
- Added `scripts/load-test-http.mjs`, a bounded GET-only harness, and ran a narrow root-page load against an isolated production web image container. Measurements are in `PERFORMANCE-BENCHMARK.md`; they do not establish guest search or gallery capacity.
- Existing 500 MiB resumable photographer upload and benchmark evidence is carried forward from Phase 4.7; original RAW files are preserved but not claimed as universally decodable.

## Actual verification results

- `pnpm lint`: passed with 0 errors and 16 existing web warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: passed: 13 API suites / 30 tests; 3 web test files / 5 tests.
- `pnpm build`: passed for API and Next.js production build.
- Playwright production-build E2E after dependency updates: 12 passed, 1 skipped. The skipped Phase 2 scenario needs its connected service fixture. Initial dev-server visual comparisons failed because network-blocked Google Fonts caused fallback font rendering; production-build visual baselines then passed at mobile, tablet, and desktop.
- `corepack pnpm audit --json` and `corepack pnpm audit --prod --json`: 0 vulnerabilities in 1,285 total / 516 production dependencies after updating vulnerable direct and transitive packages.
- Python AI service tests: 16 passed. Ruff passed on the changed AI provider/evaluator/checksum files.
- Full `ruff check app tests scripts` was attempted and reports 146 E501 line-length findings in existing research scripts. No existing tests were disabled or edited to hide this.
- `mypy app` could not execute because Windows Application Control blocked the bundled native DLL, including when launched through the virtualenv Python. This policy was not bypassed.
- Linux `mypy app` in a disposable Docker container first found an incompatible reused NumPy warmup variable in `model_manager.py`. I separated the SFace and ONNX warmup arrays; rerun passed with no issues in 7 source files. The Python suite rerun passed 16 tests (2 dependency deprecation warnings).
- Production environment validation passed using temporary unique test secrets and a temporary env file. `docker compose config --quiet` passed on the production configuration. The temporary file and dummy environment secret were removed.
- `docker info` succeeded on Docker context `desktop-linux` (Engine 29.9.3, Docker Desktop WSL2, 12 CPUs and 7.685 GiB available memory). `docker compose ps` showed all six active development services running, five healthy; web has no health check. The earlier report's Docker-unavailable conclusion was incorrect for this resumed execution environment.
- Docker image builds passed for the API, web and face-AI Dockerfiles. Builds updated image tags only; they did not recreate or restart active containers.
- Production Nginx 1.28.3 template validation passed using a temporary certificate volume, which was removed afterwards. DNS, real TLS, external reachability and production proxy startup remain unverified.
- Active-stack read-only checks passed: web HTTP 200, API health HTTP 200, PostgreSQL accepts connections, Redis returns PONG, RustFS health is OK, and face-AI liveness is alive. Live Prisma status showed all nine migrations applied and schema up to date.
- Fresh isolated PostgreSQL 17 test: all nine migrations applied successfully. A custom-format dump restored into a second tmpfs database; the synthetic marker row and all nine migration records were present.
- Isolated RustFS round-trip: a synthetic 55-byte object survived a disposable container restart and copy to a second disposable volume. Source, post-restart and restored file SHA-256 all matched `1ea10ba833d51642ec46163897a96f1c62a273bbe26b0f388c02193b1bf25058`.
- All disposable database/object test containers, test volumes and fixture files were removed. Existing Memories databases, photo objects, model data, containers and persistent volumes were preserved.
- The sequential bounded GET-only run completed 200 root-page requests at each concurrency 1, 10, 50 and 100 with zero errors on an isolated web container (1 CPU / 768 MiB). P95 was 4.72 / 73.58 / 451.42 / 378.53 ms. This is not a full-stack capacity test.

## Benchmark evidence carried forward

Phase 5.2A synthetic 300-image ControlFace10K benchmark, CPU, embedding-only:

| Model    | ROC-AUC |   EER | Precision | Recall |     F1 |     Throughput |
| -------- | ------: | ----: | --------: | -----: | -----: | -------------: |
| AuraFace |  0.9694 | 7.91% |    24.91% | 46.00% | 0.3232 |  12.98 faces/s |
| SFace    |  0.9766 | 6.00% |    25.87% | 69.33% | 0.3768 | 118.19 faces/s |

These pairwise synthetic results do not establish gallery-level wedding performance. They support only keeping SFace as a faster provisional evaluation candidate. Neither model is approved for public matching.

## Incomplete phases and external blockers

- **5.3:** No consented, manually identity-labeled wedding/event dataset was provided. The evaluation implementation is offline; an authenticated hosted administrator annotation/upload workflow is not implemented. Real-world false positives/negatives, subgroup results, detection/alignment failures, and gallery relevance remain unmeasured.
- **5.4:** Exact SFace checksum and CPU `ModelManager` load passed. Candidate migration/reindex/rollback, model-specific quality policies, multi-selfie matching, real-photo inference, and API/pgvector/NumPy numeric parity were not exercised against live test data.
- **6/6.1:** No production host, OS, domain, TLS certificate, production secrets, or independent backup destination was supplied. Synthetic isolated restore tests passed, but no live-data backup was taken; disk alerts, orphan scan, and deletion/retention rehearsal remain unverified.
- **7:** No external penetration review, production network/TLS check, complete privacy deletion rehearsal, or qualified Indian legal/privacy review. The dependency audit returned zero advisories. The consent notice is a draft requiring counsel review.
- **7.1/7.2:** Only the isolated web-root HTTP smoke run and disposable database/object restart/restore checks were executed. There are no verified capacity claims for 1k/5k/10k photographs, 25k faces, or 10/50/100 guests. Upload/index/search/ZIP failure injection remains outstanding.
- **7.3:** Linux mypy, Docker image builds, isolated migrations and provider smoke now pass. Full Ruff still reports 146 E501 findings in legacy research scripts; one connected Phase 2 E2E remains skipped; a real consented photographer-to-guest database/storage workflow was not run.
- **8:** Photographer onboarding, administrator, guest usage, troubleshooting/operations, maintenance, and security/privacy checklists are drafted. They still need the real operator's contact details, product screenshots, retention commitments, quoted cost inputs, RPO/RTO, and escalation ownership.

## Confirmed defects and corrections

- The earlier implementation included event-level approval endpoints and signed artifact handling. This follow-up removes those endpoints and the browser upload path, replaces event approval checks with an owner/admin private-search endpoint and system-level guest release gate, and retains legacy columns only to preserve existing records.
- Development visual snapshots differed when the offline dev server substituted unavailable Google Fonts. The production-build visual suite passed against the committed snapshots; the baselines were not rewritten.
- Linux type checking found one incompatible warmup-array variable; I separated the typed arrays and reran mypy successfully. No model checksum mismatch, real-world accuracy defect, migration defect, or storage corruption was confirmed.

## Deployment commands

After a real host and secrets are configured, see `PRODUCTION-DEPLOYMENT.md`. The core Linux flow is:

```sh
node scripts/verify-env.mjs .env.production --production
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d postgres redis minio
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d minio-init face-ai api web reverse-proxy
```

Set `PUBLIC_FACE_MATCHING_ENABLED=false` and `PUBLIC_FACE_MATCHING_MODEL_VALIDATED=false` unless the system-level model evaluation has been completed and reviewed. Update TLS, CORS, domains and host data paths. Commands are prepared, not executed against production.

## Files added or updated during this completion work

The repository already contained other uncommitted work at assignment start. This list names the principal completion artifacts and edits recorded here; it is not a statement that every dirty repository file originated in this assignment.

- Evaluation and model: `services/face-ai/app/config.py`, `services/face-ai/app/model_manager.py`, `services/face-ai/scripts/evaluate_gallery.py`, `services/face-ai/scripts/verify_model_checksum.py`, `services/face-ai/tests/test_embedding.py`, `services/face-ai/tests/test_evaluate_gallery.py`, `docs/representative-evaluation.md`, `docs/RECOGNITION-MODEL-DECISION.md`, `docs/phase5.4-recognition-engine.md`.
- Approval and privacy: `apps/api/src/events/events.dto.ts`, `apps/api/src/events/events.service.ts`, `apps/api/src/events/events.service.spec.ts`, `apps/api/src/public/guest-search.service.spec.ts`, `scripts/sign-evaluation-artifact.mjs`, `scripts/verify-env.mjs`, `docs/PRODUCTION-SECURITY-REVIEW.md`, `docs/PRIVACY-CONSENT-TEMPLATE.md`.
- Deployment and operations: `.env.production.example`, `docker-compose.production.yml`, `infrastructure/nginx/production.conf.template`, `infrastructure/docker/minio-cors-production.json`, `docs/PRODUCTION-DEPLOYMENT.md`, `docs/BACKUP-AND-RECOVERY.md`, `docs/PERFORMANCE-BENCHMARK.md`, `docs/PRODUCTION-SECURITY-REVIEW.md`, `docs/SECURITY-PRIVACY-CHECKLIST.md`, `docs/OPERATIONS-MAINTENANCE.md`, `docs/COMMERCIAL-LAUNCH-CHECKLIST.md`, `docs/PHOTOGRAPHER-ONBOARDING.md`, `docs/ADMINISTRATOR-GUIDE.md`, `docs/GUEST-USAGE-GUIDE.md`, `docs/TROUBLESHOOTING-OPERATIONS.md`, `scripts/load-test-http.mjs`.
- Dependency remediation: `package.json`, `pnpm-lock.yaml`, `apps/api/package.json`, `apps/web/package.json`, `packages/config/package.json`.
- Tracking: `docs/MASTER-COMPLETION-TRACKER.md`, `docs/MASTER-COMPLETION-REPORT.md`.

## Required manual actions

Provide a consented representative event dataset and verified labels, production host/domain/TLS/network configuration, independent backup target, and qualified legal review. Then run Docker-backed migrations and workflow checks, restore rehearsal, dependency/penetration review, failure injection, and gradually staged load tests. Keep system-level public matching disabled until its documented validation gates are met.
