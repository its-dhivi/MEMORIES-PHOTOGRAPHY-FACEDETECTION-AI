# Phase 4.7 guest bulk download

Guests can enter selection mode, select or deselect individual authorized matches, select all
matches, cancel, and request a ZIP containing only the selected subset. Mobile uses a safe-area-aware
sticky toolbar; desktop uses the same contextual bar without turning the gallery into a file manager.

`POST /api/v1/public/searches/:searchId/download-selected` accepts UUIDs but never trusts them. The
API revalidates every ID against the current session, event, unexpired completed search, current
biometric consent, ready/non-deleted photo, and download settings. Any unauthorized ID rejects the
whole request. Existing download-all behavior remains available through the same worker.

The worker reads one original stream at a time and pipes it to an `archiver` ZIP64 stream using store
mode, appropriate for already-compressed photographs. The archive is streamed directly to private
object storage. Defaults are 250 photos, 10 GiB uncompressed input, approximately 11 GiB output,
one ZIP worker, and a one-hour operational timeout target. Completion is reported only after storage
upload succeeds. Download URLs remain short lived.
