# API

Base path: `/api/v1`; Swagger: `/docs`.

## Internal AI

- `GET /health/live`
- `GET /health/ready`
- `POST /internal/v1/faces/analyze`
- `POST /internal/v1/faces/embed-selfie`

Inference endpoints require `X-Internal-Token` and multipart `file`, and must remain on private networks.

## Guest matching

- `POST /api/v1/public/events/:slug/sessions`
- `GET /api/v1/public/events/:slug/session`
- `POST /api/v1/public/events/:slug/consent`
- `POST /api/v1/public/events/:slug/search`
- `GET /api/v1/public/searches/:searchId`
- `GET /api/v1/public/searches/:searchId/results`
- `POST /api/v1/public/photos/:photoId/download` with `{ "searchId": "uuid" }`
- `POST /api/v1/public/searches/:searchId/download-all`
- `POST /api/v1/public/searches/:searchId/download-selected` with `{ "photoIds": ["uuid"] }`
- `GET /api/v1/public/download-jobs/:jobId`

After session creation, callers send `X-Guest-Session`. Search accepts multipart `selfie`. Public responses omit embeddings, raw similarity, object keys, and unrelated galleries. Result image URLs are short-lived derivatives.

Browsers do not call credentialed guest routes directly. The Next.js `/api/guest/*` BFF stores the token in an HttpOnly cookie and injects `X-Guest-Session` server-side. Its allowlist mirrors only the guest operations above and all guest-specific responses use `Cache-Control: no-store`.

## Administration

`POST /api/v1/processing/events/:eventId/reindex` queues up to 1,000 model-incompatible photos. Processing stats include model readiness, worker count, indexed/no-face/failed totals, and average processing duration.

## Professional photo import

- `POST /api/v1/events/:eventId/photos/upload-init`
- `POST /api/v1/events/:eventId/photos/upload-part`
- `GET /api/v1/events/:eventId/photos/uploads/:sessionId`
- `POST /api/v1/events/:eventId/photos/upload-complete`
- `DELETE /api/v1/events/:eventId/photos/uploads/:sessionId`

All routes require the existing administrator session, CSRF protection where applicable, and event
membership. Upload initialization chooses a single PUT or multipart session based on configured
size. Part URLs are short-lived and bind the checksum header. Completion lists and verifies stored
parts and metadata before creating the photo record and queueing derivative work. The client can
resume from server-reported completed parts or explicitly abort an unfinished session.
