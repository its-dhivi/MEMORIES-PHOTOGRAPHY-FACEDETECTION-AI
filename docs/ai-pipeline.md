# AI pipeline

The private FastAPI service runs OpenCV YuNet detection and AuraFace V1 ONNX recognition locally on CPU. Model weights are stored outside Git in the private Docker model volume and verified at startup. The recognition contract is RGB, 112 × 112, NCHW float32, `(pixel - 127.5)/127.5`, a finite 512-dimensional output, and L2 normalization. Event photos and guest selfies use the same model manager and preprocessing version.

The upload worker decodes and orients the original photograph, creates private thumbnail, preview, and 4096-pixel AI input derivatives, then indexes faces from a bounded global YuNet pass plus overlapping tiles. Original photographs are preserved. Rejected faces retain diagnostic reasons; accepted embeddings carry model and preprocessing versions. A resumable reindex command updates detection versions while preserving the previous embedding until a replacement succeeds.

Guests provide explicit biometric consent and a single selfie, which is held in memory only. PostgreSQL scores accepted, version-compatible faces in the same event using `1 - cosine distance`, takes the maximum score per photo, then applies the event-approved threshold. Public matching requires explicit approval backed by representative consented evaluation. Guest sessions, download permissions, result expiration, and audit logging remain enforced.

See [Phase 5 audit and benchmark](phase5-face-recognition-accuracy.md) for measurements, reindexing, calibration, limitations, and production readiness. No wedding-photo accuracy has yet been verified.
