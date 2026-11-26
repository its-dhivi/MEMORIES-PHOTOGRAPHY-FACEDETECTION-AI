ALTER TABLE "Photo"
  ADD COLUMN "faceCount" INTEGER,
  ADD COLUMN "skippedFaceCount" INTEGER,
  ADD COLUMN "modelVersion" VARCHAR(80),
  ADD COLUMN "processingDurationMs" INTEGER;

ALTER TABLE "FaceEmbedding"
  ADD COLUMN "qualityScore" DECIMAL(6,5),
  ADD COLUMN "qualityStatus" VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PhotoSearch" ADD COLUMN "modelVersion" VARCHAR(80);

CREATE INDEX "FaceEmbedding_eventId_modelVersion_idx"
  ON "FaceEmbedding"("eventId", "modelVersion");

CREATE INDEX "Photo_eventId_modelVersion_status_idx"
  ON "Photo"("eventId", "modelVersion", "status");
