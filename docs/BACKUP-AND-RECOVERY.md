# Backup and recovery

## Required protected data

Back up PostgreSQL and RustFS object data independently. Photograph originals cannot be reconstructed from embeddings or thumbnails. Treat model artifacts and deployment configuration as reproducible but checksum-controlled inputs.

## Before release

1. Pause or drain upload/indexing workers and record queue state.
2. Take a PostgreSQL logical or physical backup using the deployment's approved method.
3. Snapshot/copy RustFS data while preserving object keys and metadata.
4. Record backup timestamps, sizes, and SHA-256 manifests; keep a separate copy on a different failure domain.
5. Resume workers after consistency checks.

## Restore rehearsal

Restore database and object data into an isolated environment, verify migrations, object counts and sampled original downloads/checksums, then run health and authorization smoke checks. Do not restore over production without a reviewed recovery window and verified backup.

## Production Compose paths

`POSTGRES_DATA_DIR` and `OBJECTS_DATA_DIR` in `.env.production` are host paths. They must be backed up independently to a different failure domain. The production Compose file keeps Redis append-only data in its named volume; queue persistence is not a substitute for durable photo and database backups. Record the chosen offsite destination, encryption keys, backup retention, RPO/RTO, and low-space thresholds before launch.

## Restore rehearsal evidence

Isolated rehearsal evidence (2026-11-27):

- Applied all nine repository migrations to a fresh PostgreSQL 17 test container using tmpfs only. Added one synthetic marker row, produced a custom-format `pg_dump`, restored into a second fresh PostgreSQL 17 tmpfs container, then verified the marker and all nine migration records.
- Uploaded a 55-byte synthetic object to a disposable RustFS volume. Restarted that RustFS container and verified the downloaded SHA-256 matched the source. Copied the object to a second disposable RustFS volume and verified the restored object hash also matched.
- Removed the test containers and their two dedicated object-storage test volumes. The active `postgres_data`, `minio_data`, `redis_data`, and `face_models` volumes were not used or removed. The active database itself reports all nine migrations up to date.

These checks validate isolated tooling and round-trip mechanics only. They are not a backup of live photographs or production data and do not verify offsite retention, encryption, metadata/object counts at scale, or disaster recovery. Use a disposable restore host, never overwrite production for a rehearsal. Preserve a SHA-256 inventory and verify sampled original object checksums, database migrations, and event/photo counts before sign-off. RAID is not a backup.
