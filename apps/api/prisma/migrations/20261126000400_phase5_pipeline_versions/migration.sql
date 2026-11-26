ALTER TABLE "Photo" ADD COLUMN "detectionVersion" VARCHAR(80);
ALTER TABLE "PhotoSearch" ADD COLUMN "preprocessingVersion" VARCHAR(80);
ALTER TABLE "EventSettings"
  ADD COLUMN "previousSimilarityThreshold" DECIMAL(4,3),
  ADD COLUMN "matchingApprovedAt" TIMESTAMP(3),
  ADD COLUMN "matchingApprovedById" UUID,
  ADD COLUMN "matchingModelVersion" VARCHAR(80),
  ADD COLUMN "matchingPreprocessingVersion" VARCHAR(80),
  ADD COLUMN "matchingApprovalEvidence" JSONB;
ALTER TABLE "FaceEmbedding" ADD COLUMN "preprocessingVersion" VARCHAR(80) NOT NULL DEFAULT 'auraface-rgb-112-v1';

ALTER TABLE "FaceEmbedding" DROP CONSTRAINT "FaceEmbedding_face_model_key";
ALTER TABLE "FaceEmbedding"
  ADD CONSTRAINT "FaceEmbedding_face_model_preprocessing_key"
  UNIQUE ("photoId", "faceIndex", "modelName", "modelVersion", "preprocessingVersion");

CREATE INDEX "FaceEmbedding_event_model_preprocessing_idx"
  ON "FaceEmbedding" ("eventId", "modelVersion", "preprocessingVersion");
