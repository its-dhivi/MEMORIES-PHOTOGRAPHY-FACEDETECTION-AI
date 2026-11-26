# Security and privacy launch checklist

Use this checklist with the [security review](PRODUCTION-SECURITY-REVIEW.md) and have the final controls reviewed by qualified Indian privacy/security counsel. A completed checklist is not, by itself, evidence of legal compliance.

## Identity and access

- [ ] Require individual accounts, strong authentication, least-privilege roles, and timely account removal.
- [ ] Verify tenant, event, guest-session, consent, search ownership, expiry, and photo authorization on every relevant API path.
- [ ] Keep administrator diagnostics and evaluation data restricted and audited.
- [ ] Verify downloads and ZIP jobs cannot disclose another event's or tenant's objects.
- [ ] Rate-limit PIN attempts, searches, uploads, downloads, and archive creation.

## Network and application

- [ ] Serve app and signed S3 traffic only over HTTPS with valid certificates and current security headers.
- [ ] Expose only the reverse proxy; keep PostgreSQL, Redis, RustFS administration, API, web internals, and face-AI private.
- [ ] Use unique production secrets from a secret manager; restrict signing-secret access and rotate on exposure.
- [ ] Verify CORS against the exact app origin, CSRF protections, session expiry, and same-origin mutation checks.
- [ ] Review upload signatures, byte/pixel limits, image decoder behavior, ZIP entry paths, and temporary-file cleanup.
- [ ] Keep SQL parameterized and encode untrusted output; review SSRF-capable URL handling and dependency alerts.
- [ ] Keep raw selfies, embeddings, tokens, credentials, full signed URLs and private labels out of logs.

## Biometric privacy

- [ ] Present an understandable purpose, event scope, retention period, and privacy contact before optional biometric processing.
- [ ] Obtain and record explicit consent before search; make withdrawal accessible and stop further session downloads after withdrawal.
- [ ] Verify face search is event-scoped with no cross-event identity tracking or unauthorized sharing.
- [ ] Test deletion of selfies/session data, search results, embeddings, evaluation artifacts and event data under the approved policy.
- [ ] Limit and audit access to consented evaluation photos and labels; do not infer ground truth from model predictions.
- [ ] Keep public event matching disabled until the exact model license, representative gallery evaluation, threshold calibration and signed event approval are satisfied.

## Operations and legal review

- [ ] Verify encrypted/controlled backups, independent restore tests, retention, and incident response.
- [ ] Document data controller/processor roles, vendor/subprocessor inventory, breach response, contact channel and child-safety handling.
- [ ] Have counsel review current Indian data-protection commencement/rules, biometric consent language, contracts and retention/deletion obligations before commercial operation.
- [ ] Record evidence, owner, date, and any exception for each item. Recheck after material changes.
