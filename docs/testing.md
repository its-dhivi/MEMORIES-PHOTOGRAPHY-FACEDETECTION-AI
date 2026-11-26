# Testing

Node: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Python 3.11/3.12: `pytest`, `ruff check app tests scripts`, and `mypy app`.

Automated coverage includes missing-model readiness, invalid internal credentials, corrupted/unsupported images, finite normalized deterministic embeddings, consent enforcement, cross-session denial, event/model bindings in vector SQL, successful no-face indexing, tenant isolation, uploads, CSRF, dashboard scoping, and UI forms.

Recognition-accuracy suites intentionally require separately managed licensed and consented fixtures. Before production, execute single/multiple/no-face, blur, low-light, same/different-person, threshold, event isolation, deleted-photo, throughput, and full database/storage tests. Never fabricate metrics.

The local stack can use checksum-pinned OpenCV Zoo YuNet and SFace artifacts provisioned outside
Git. Readiness, real ONNX inference, event-photo indexing, and same-image selfie matching must be
verified after provisioning. Accuracy calibration across different photographs still requires a
representative, explicitly consented validation set; a same-image smoke test is not an accuracy
claim.

# Phase 4 validation

Frontend unit coverage includes denied camera permission, the upload fallback, and invalid selfie types. Backend authorization tests cover missing consent, cross-session search ownership, unauthorized photo IDs, and disabled downloads. Recognition tests remain separate from UI and authorization tests because real inference requires licensed model weights and consented fixtures.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `docker compose config`. Apply the Phase 4 migration before exercising download-all. A real recognition E2E must not be reported as passing until licensed detector/recognizer weights are installed.

## Phase 4.5 UI validation

- `phase45-visual.spec.ts` captures the public experience at 390px, 768px, and 1440px and compares committed Windows baselines.
- `phase45-accessibility.spec.ts` runs axe WCAG 2 A/AA, 2.1 AA, and 2.2 AA rules against the public and login routes with reduced motion enabled.
- `phase4-guest-ui.mocked.spec.ts` clearly labels mocked guest and kiosk flows. The kiosk case verifies that finishing invokes consent withdrawal before resetting for the next guest.
- Authenticated dashboard screenshots still require an administrator fixture or a dedicated mocked-dashboard harness; unit and production-build coverage continues to protect those routes meanwhile.
