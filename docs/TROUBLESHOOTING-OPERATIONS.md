# Troubleshooting and operations

Run commands from the deployment directory. Start with status and health checks; do not delete volumes or clean object storage to resolve an application symptom.

## Services not ready

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml logs --tail 100 api face-ai postgres redis minio
```

Check DNS, certificates, free disk space, and the configured persistent paths. Do not expose internal service ports to the internet while debugging. If any service is restarting, capture timestamps and redacted error messages, then check its health dependency and resource limits.

## Upload does not finish

- Confirm that the browser can reach the app and the configured signed S3 hostname over HTTPS.
- Check the event upload list for the failed file and its server-reported status. Retry only that file after confirming its signature and size are valid.
- If resuming, reselect the same source file when requested. The client verifies size and SHA-256; a changed file must start a new upload.
- A RAW original may be stored without a decoded preview or face index. Confirm the exact format is supported by the host's decoder before reprocessing.
- Check object storage capacity and multipart upload errors. Avoid deleting partial objects manually; use the upload cancellation/expiry cleanup workflow.

## Indexing or model errors

- Check face-AI liveness/readiness, model version, preprocessing version, and configured model path. Verify each model's pinned checksum using the model evaluation guide.
- Use the event photo diagnostics page to review no-face, quality rejection, alignment, indexing, and model-version reasons.
- Reindex only after confirming the target model/version and a recovery plan. Monitor queue progress and failures; do not repeatedly enqueue a failing batch.
- Never replace the active production model in place as a troubleshooting step. Keep the previous image tag, vector version, database backup, and originals available for rollback.

## Guest reports missing or unexpected results

- Confirm the event is open, matching is approved with the signed artifact for the active model/preprocessing versions, and the guest session has not expired or withdrawn consent.
- Check that the photos have completed indexing and that matching is scoped to the correct event. Do not lower thresholds to fix one report without independent calibration.
- Explain that a zero result may be a false negative and that a shown result may be wrong. Arrange a photographer review through the approved support channel.
- If a guest cannot download, verify event download settings, session ownership, consent state, result expiry, and ZIP job status. Do not send signed URLs through chat or email.

## Backup, disk, and incident response

Follow [Backup and recovery](BACKUP-AND-RECOVERY.md) for database/object backup and isolated restores. Check filesystem capacity and backup freshness before cleanup or migration. If disk space is low, pause new uploads/indexing, alert the operator, and expand or safely free approved temporary files only after confirming they are not active multipart, ZIP, or processing work.

For suspected privacy or security incidents, restrict access and follow the incident plan; do not include selfies, embeddings, guest tokens, full signed URLs, passwords, or secret environment values in logs or support tickets. Escalation: `[on-call administrator/contact]`.
