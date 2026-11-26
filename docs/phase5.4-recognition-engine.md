# Phase 5.4 recognition engine and migration

## Implemented

The FastAPI recognition manager now selects between the existing generic ONNX provider and OpenCV Zoo SFace through `FACE_MODEL_PROVIDER`. AuraFace retains ONNX Runtime preprocessing. SFace uses OpenCV `FaceRecognizerSF.alignCrop` and `feature`, enforces CPU execution, checks its expected 128-dimensional output, and L2-normalizes before writing the existing `vector(512)` shape via zero padding. Model name/version and preprocessing version are emitted with each response. A lock serializes OpenCV SFace recognition calls.

The API's query filters require event ID plus matching model and preprocessing versions. AuraFace and SFace vectors remain isolated. Private owner/admin searches are available without event-level approval. Public guest matching remains fail-closed unless the event toggle and system-level model-validation flags are enabled and active model versions match. Candidate mode is not guest-visible.

## Candidate configuration

For an isolated candidate stack, configure the face-AI service and API with the same values:

```dotenv
FACE_MODEL_PROVIDER=sface
FACE_MODEL_NAME=opencv-sface
FACE_MODEL_VERSION=opencv-sface-2021dec-v1
FACE_PREPROCESSING_VERSION=sface-opencv-aligncrop-112-v1
FACE_RECOGNITION_MODEL_PATH=/models/face_recognition_sface_2021dec.onnx
FACE_RECOGNITION_OUTPUT_DIMENSION=128
FACE_EMBEDDING_DIMENSION=512
FACE_RECOGNITION_INPUT_NORMALIZATION=none
FACE_DEVICE=cpu
```

Verify the artifact with `python services/face-ai/scripts/verify_model_checksum.py <model.onnx>` before loading it. Do not change the active production stack to candidate settings without an approved maintenance and rollback window. Reindex only isolated evaluation data first; compare results on identical event/person splits.

## Migration and rollback

1. Preserve originals and existing AuraFace embeddings. Back up database and object data.
2. Start a separate candidate provider/version and create candidate embeddings under its distinct model and preprocessing labels.
3. Confirm candidate indexing is complete and compare gallery metrics against the frozen evaluation split.
4. If rejected, restore prior API/AI environment and image tag. Version-filtered candidate vectors remain ineligible for the old approval; clean them only through a reviewed, event-scoped retention operation after backup. Reindex photos that were overwritten in the `Photo.modelVersion` summary field if needed; embedding rows themselves preserve the versioned index.
5. If a migration is approved, switch API and AI configuration together, run resumable reindexing with progress/failure checks, confirm event coverage for that version, and complete system-level validation before enabling public matching. Never compare or reuse thresholds across model/preprocessing versions without recalibration.

## Incomplete capability

The implementation covers AuraFace-compatible ONNX and SFace. Future custom ONNX formats may require a new input-layout/preprocessing adapter; arbitrary models are not guaranteed compatible. Model-specific size/blur/exposure quality policies and independently validated thresholds are not yet configurable; the shared detector quality policy remains active. No representative photo experiment supports changes to multi-selfie, aggregation, detection thresholds, or quality filters. The exact SFace file checksum and provider/detector initialization were verified in an isolated Linux container; end-to-end inference on a consented event face and version migration/rollback remain unverified.
