# Operations and maintenance checklist

Set actual alert thresholds, owners, backup RPO/RTO, contact details, and maintenance windows with the production operator. The figures below are checks to perform; they are not capacity or uptime guarantees.

## Each operating day

- [ ] Review service health and recent errors:

  ```sh
  docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
  docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --since 24h --tail 500 api face-ai
  ```

- [ ] Review queue backlog, failed indexing and download jobs, stalled multipart sessions, and guest reports.
- [ ] Check free space on PostgreSQL, object, temporary and backup filesystems; compare to the operator-set warning/critical limits.
- [ ] Confirm the most recent database and object backups completed and reached the independent backup destination.
- [ ] Check TLS expiry, service restart counts, CPU/memory trends, and unhandled alerts.
- [ ] Redact tokens, biometric data, signed URLs and guest identifiers before sharing diagnostic excerpts.

## Weekly

- [ ] Review audit events and administrative access; disable accounts that no longer need access.
- [ ] Reconcile failed uploads, expired upload sessions, indexing failures, and completed ZIP artifacts through supported application workflows.
- [ ] Confirm backup manifests and object inventory job ran; investigate count/hash discrepancies without deleting source data.
- [ ] Review retention and deletion requests, including the completion status of event-scoped cleanup.

## Monthly

- [ ] Apply operating-system and container security updates after staging verification; review the dependency audit and image provenance.
- [ ] Verify model artifact checksums and confirm the active model/preprocessing versions still match each approved event.
- [ ] Review storage growth, backup capacity, queue times, error rates and download traffic; update cost estimates from actual usage.
- [ ] Verify certificates, secret ownership, and access to the independent backup location.
- [ ] Test database restore and object restore in an isolated environment. Record duration and integrity checks.

## Each release or model migration

- [ ] Back up database metadata and object data and confirm restore prerequisites.
- [ ] Validate production environment configuration, Compose rendering, container builds, migrations and health checks.
- [ ] Run authorization, upload/download, event-isolation and recovery regression tests using isolated data.
- [ ] For model changes, use held-out consented evaluation events and independently calibrated gallery metrics. Keep public approval off until a newly signed event artifact passes policy.
- [ ] Record release commit/image IDs, model checksum/version, migration result, rollback tag and operator.

## After an event

- [ ] Confirm indexing and guest download work have settled.
- [ ] Confirm event backups are in the selected retention plan and delete them only after retention authorization.
- [ ] Process guest privacy/deletion requests and record completion without including biometric contents in the log.
- [ ] Review event-level storage usage and support issues; update the operator's incident notes.

No automated alerting, low-space recovery threshold, offsite backup target, or production RPO/RTO was supplied or verified in this assignment. Assign these before customer onboarding. See [Backup and recovery](BACKUP-AND-RECOVERY.md) and [Troubleshooting](TROUBLESHOOTING-OPERATIONS.md).
