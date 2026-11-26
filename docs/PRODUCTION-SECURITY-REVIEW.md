# Production security review

## Current evidence

See [security.md](security.md) for existing controls: event/session-bound guest search, explicit consent, rate limits, private object storage, short-lived download links, signature-based image decoding, byte/pixel limits, and no public embedding exposure. The public matching approval gate remains in place.

## Release blockers / verification required

- Development Compose publishes internal ports. Use only the separate production override for public exposure; real production Compose startup, firewall behavior, and external network scans still need operator verification.
- Configure TLS, managed secrets, encryption at rest, retention/deletion operations, audit export, abuse monitoring, and operational alerting.
- Dependency audit is currently clean; rerun it for each dependency change. Keep production API authorization, cross-event access and download authorization regression tests in CI, and obtain an external penetration review before launch.
- Obtain qualified review of India privacy/biometric, consent, child-safety, and retention obligations; this document is not a legal compliance claim.
- Keep raw selfies, embeddings, tokens, and signed URLs out of logs and restrict evaluation artifacts to authorized operators.
- Keep `EVALUATION_SIGNING_SECRET` outside browser/API request data except the signature itself; signed reports must be produced by a trusted evaluator and remain access-controlled.

No unresolved critical defect is asserted without a completed targeted test. Commercial security readiness is not verified.

## Production Compose review

`docker-compose.production.yml` is now a separate hardening override with only the reverse proxy binding public TCP ports, Redis AUTH, CPU-only face inference, bind-mounted persistent PostgreSQL/object paths, health checks, restart policies, resource caps, and bounded JSON logs. PostgreSQL, Redis, RustFS console, API, web, and face AI have no host port mappings in that override. The S3 API is reachable through its own TLS reverse-proxy hostname because browsers need the signed multipart endpoints; keep buckets private, preserve the signed `Host`/path, restrict CORS to the application origin, and firewall the host so only required proxy ports are open. Production approval now requires an event-bound HMAC-signed evaluation artifact plus gallery-level sample, precision, recall, and false-acceptance gates; the regression suite rejects an unsigned direct API attempt.

Compose configuration syntax validation previously succeeded with sanitized temporary values. Docker Engine access is verified on the `desktop-linux` context (29.9.3); API, web and face-AI images build, and the active development stack reports five healthy services out of six. `pnpm audit` reports zero advisories across 1,285 total / 516 production dependencies. No external penetration test, production host-port scan, production TLS test, live-data backup/restore, legal opinion, or third-party audit is claimed. The consent/privacy wording is a review draft in [PRIVACY-CONSENT-TEMPLATE.md](PRIVACY-CONSENT-TEMPLATE.md); it must be aligned with actual processing, current commencement dates, contract roles, children, and retention by qualified counsel.

The rendered Nginx 1.28.3 production template passed `nginx -t` with a disposable self-signed test certificate. The template's deprecated HTTP/2 listen syntax was updated and the final validation was warning-free. This does not validate a production certificate, DNS, firewall or external exposure.
