# Database

Migration `20261120000200_phase3_face_pipeline` adds photo face/skipped counts, model version, processing duration, embedding quality/status/timestamp, search model version, and event/model indexes.

Each accepted face is a `FaceEmbedding` row containing `vector(512)`, event/photo IDs, face index, model name/version, bounding box, confidence, and quality. Reprocessing deletes and replaces a photo's rows transactionally. Low-quality detections are counted but receive no vectors.

Search SQL uses bound Prisma parameters and `embedding <=> query::vector`. It filters event and model, excludes deleted/non-ready photos, and stores one ranked result per photo.

The global HNSW cosine index remains, with event/model B-tree filtering. Exact versus approximate plans must be measured with `EXPLAIN (ANALYZE, BUFFERS)`; HNSW is not assumed optimal for every event size. Apply migrations only through `prisma migrate deploy`.

# Phase 4 additions

Migration `20261120000300_phase4_guest_downloads` adds `DownloadJobStatus` and `GuestDownloadJob`. Each job is linked to one event, guest session, and photo search, with unique queue/object identifiers, bounded size metadata, expiry, status, and failure code. Indexes support ownership/status lookup, search lookup, and expiry cleanup. Consent withdrawal and session deletion cascade or expire these records without touching event photographs.

# Phase 4.7 additions

Migration `20261120000400_phase47_professional_import` records multipart upload mode, provider upload
ID, and part size on `UploadSession`; original format, AI-input object key, and derivative status on
`Photo`; and the authorized selected photo UUID set on `GuestDownloadJob`. Existing rows remain
valid through nullable fields and defaults. Previously applied migrations are unchanged.
