ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'PHOTO_DELETE';

CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED', 'CANCELLED');

CREATE TABLE "UploadSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "objectKey" TEXT NOT NULL UNIQUE,
  "originalFilename" TEXT NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL UNIQUE,
  "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "photoId" UUID UNIQUE,
  "failureCode" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UploadSession_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UploadSession_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "UploadSession_eventId_sha256_status_key" UNIQUE ("eventId", "sha256", "status")
);

CREATE INDEX "UploadSession_eventId_status_idx" ON "UploadSession"("eventId", "status");
CREATE INDEX "UploadSession_expiresAt_status_idx" ON "UploadSession"("expiresAt", "status");
CREATE INDEX "UploadSession_requestedById_idx" ON "UploadSession"("requestedById");
