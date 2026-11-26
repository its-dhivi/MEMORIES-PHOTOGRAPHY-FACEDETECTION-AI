# Production deployment (self-hosted)

## Included artifacts and network exposure

Use `docker-compose.yml` with `docker-compose.production.yml`. The production override removes host port bindings for PostgreSQL, Redis, RustFS, API and web, enables Redis authentication, applies restart/resource/log policies, and mounts PostgreSQL and RustFS data on operator-selected host directories. Only the reverse proxy binds public ports 80/443. The API receives the complete application environment; migration receives only `DATABASE_URL`; face AI receives its service token and model settings; web receives only its internal API URL plus the public API URL at build time. Browser multipart uploads require a signed S3 endpoint, so the proxy also exposes the RustFS S3 API on `S3_PUBLIC_DOMAIN`; buckets remain private and requests use short-lived signatures. Do not publish RustFS administration port 9001.

The proxy expects `TLS_CERT_DIR/fullchain.pem` and `TLS_CERT_DIR/privkey.pem`. The certificate must cover both the app and S3 hostnames. The example CORS file allows `https://photos.example.in`; replace it with the exact production app origin. Set strong, unique secrets and URL-encode database/Redis passwords in their connection URLs. `.env.production.example` is a template and will fail validation until completed.

## Linux deployment

1. Provision a supported Linux host, Docker Engine and Compose v2.24 or newer (for Compose `!reset`/`!override` tags), DNS for the app and S3 subdomains, firewall rules allowing only 80/443 inbound, TLS certificate, and protected secret backup. Prefer PostgreSQL/Redis on SSD; use HDD-backed storage for original images/objects. Set restrictive filesystem permissions and provision independent backup capacity.
2. Copy the template to `.env.production`; replace every placeholder. Inject `EVALUATION_SIGNING_SECRET` into the Compose process environment through the host's secret manager; it is deliberately absent from service env files and passed only to the API. Create the configured PostgreSQL, object, and TLS directories. Point `POSTGRES_DATA_DIR`, `OBJECTS_DATA_DIR`, and `TLS_CERT_DIR` to absolute paths on intended disks. Keep env/TLS files out of Git. Update `infrastructure/docker/minio-cors-production.json` to the exact app origin before startup.
3. Run preflight and review resolved configuration without publishing it:

```sh
node scripts/verify-env.mjs .env.production --production
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml build
```

4. Start dependencies, run the migration as a one-shot command, inspect its exit code/log, then start application services:

```sh
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d postgres redis minio
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up migrate
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up -d minio-init face-ai api web reverse-proxy
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
```

Verify both hostnames, TLS, health checks, private service port exposure from outside, signed upload/download, restart persistence, and an isolated end-to-end event before accepting customers. Keep matching approval off until its separate release gates are met.

## Windows / WSL2

Run production containers inside a supported Linux WSL2 distribution. Keep database/object data on Linux filesystems rather than `/mnt/c`, use Linux file permissions, and follow the Linux steps from that distribution. Ensure Docker Desktop allocates resources for the stack. Docker Engine access and image builds were verified on the development `desktop-linux` context, but this production override has not been started with real host paths, secrets, DNS, or TLS certificates.

## Operations and limits

Monitor CPU, memory, queue delay, database health, free disk space, TLS expiry and backup freshness. Production face inference concurrency defaults to one; tune it only from workload evidence. Compose memory caps are starting limits, not capacity proof. Provide approved, checksum-verified models in the persistent model volume. The physical host, OS, domain, certificates, public network, credentials and storage mounts were not supplied; no remote deployment has occurred.
