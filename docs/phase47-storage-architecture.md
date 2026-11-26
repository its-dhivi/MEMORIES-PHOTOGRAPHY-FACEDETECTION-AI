# Phase 4.7 storage architecture

`StorageService` is the private S3-compatible adapter. It supports single PUT, multipart create,
checksum-bound part URLs, server-side part listing, ordered completion, abort, metadata lookup,
streaming reads, private derivatives, and expiring downloads. Credentials never reach the browser.

## Providers

- **Local MinIO/RustFS:** configure `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, region, credentials, and
  private bucket names. Docker Compose remains the supported local configuration.
- **Cloudflare R2:** use the account S3 endpoint for both server and browser-reachable endpoint,
  `auto` region where required, path-style compatibility, bucket CORS, and least-privilege tokens.
- **Backblaze B2 S3:** use the regional S3 endpoint and application key restricted to the two
  buckets. Multipart checksum behavior must be verified in staging for the selected region.

Provider endpoints are configuration, never hardcoded. Existing objects are not migrated. If a
provider migration is needed, copy to a new private bucket, compare byte length and SHA-256 metadata,
sample-download and decode derivatives, switch configuration only after verification, and retain the
source until rollback expiry.

## Object layout

- Originals remain unchanged in the originals bucket.
- Thumbnail and display WebP derivatives live in the derivatives bucket.
- A bounded JPEG AI derivative prevents face indexing from loading a 500 MiB original.
- ZIP64 archives are streamed into derivative storage and deleted after expiry.

Production policies should expire abandoned multipart uploads independently as a second line of
defense. Storage credentials should allow only the required bucket/object and multipart operations.
