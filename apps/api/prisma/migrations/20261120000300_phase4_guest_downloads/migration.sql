CREATE TYPE "DownloadJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

CREATE TABLE "GuestDownloadJob" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "guestSessionId" UUID NOT NULL,
  "searchId" UUID NOT NULL,
  "status" "DownloadJobStatus" NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "objectKey" TEXT,
  "totalPhotos" INTEGER NOT NULL,
  "estimatedBytes" BIGINT NOT NULL,
  "byteSize" BIGINT,
  "failureCode" VARCHAR(80),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "GuestDownloadJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestDownloadJob_queueJobId_key" ON "GuestDownloadJob"("queueJobId");
CREATE UNIQUE INDEX "GuestDownloadJob_objectKey_key" ON "GuestDownloadJob"("objectKey");
CREATE INDEX "GuestDownloadJob_guestSessionId_status_idx" ON "GuestDownloadJob"("guestSessionId", "status");
CREATE INDEX "GuestDownloadJob_expiresAt_status_idx" ON "GuestDownloadJob"("expiresAt", "status");
CREATE INDEX "GuestDownloadJob_searchId_idx" ON "GuestDownloadJob"("searchId");
ALTER TABLE "GuestDownloadJob" ADD CONSTRAINT "GuestDownloadJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestDownloadJob" ADD CONSTRAINT "GuestDownloadJob_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestDownloadJob" ADD CONSTRAINT "GuestDownloadJob_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PhotoSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
