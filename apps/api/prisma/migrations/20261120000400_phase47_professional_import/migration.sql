ALTER TABLE "Photo"
  ADD COLUMN "aiInputKey" TEXT,
  ADD COLUMN "originalFormat" VARCHAR(16),
  ADD COLUMN "derivativeStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING';

ALTER TABLE "UploadSession"
  ADD COLUMN "uploadMode" VARCHAR(16) NOT NULL DEFAULT 'SINGLE',
  ADD COLUMN "multipartUploadId" VARCHAR(512),
  ADD COLUMN "partSize" INTEGER;

ALTER TABLE "GuestDownloadJob"
  ADD COLUMN "selectedPhotoIds" JSONB;

CREATE INDEX "UploadSession_multipartUploadId_idx"
  ON "UploadSession"("multipartUploadId");
