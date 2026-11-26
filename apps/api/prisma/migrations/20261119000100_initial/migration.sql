CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN','USER');
CREATE TYPE "StudioRole" AS ENUM ('OWNER','ADMIN','PHOTOGRAPHER');
CREATE TYPE "EventType" AS ENUM ('WEDDING','RECEPTION','BIRTHDAY','CORPORATE','OTHER');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','ACTIVE','EXPIRED','ARCHIVED','DELETING');
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING','UPLOADING','UPLOADED','QUEUED','PROCESSING','READY','FAILED','DELETED');
CREATE TYPE "JobType" AS ENUM ('PHOTO_PROCESS','THUMBNAIL_GENERATE','EVENT_DELETE','ZIP_EXPORT','SELFIE_SEARCH');
CREATE TYPE "JobStatus" AS ENUM ('PENDING','ACTIVE','RETRYING','COMPLETED','FAILED','DEAD_LETTER');
CREATE TYPE "GuestSessionStatus" AS ENUM ('ACTIVE','EXPIRED','REVOKED');
CREATE TYPE "SearchStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','EXPIRED');
CREATE TYPE "ConsentType" AS ENUM ('BIOMETRIC_PROCESSING','PRIVACY_NOTICE','TERMS');
CREATE TYPE "AuditActorType" AS ENUM ('USER','GUEST_SESSION','SYSTEM');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
  "emailVerifiedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Studio" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(100) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "StudioMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studioId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "StudioRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioMember_studioId_userId_key" UNIQUE ("studioId","userId")
);
CREATE TABLE "Event" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studioId" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "type" "EventType" NOT NULL,
  "description" TEXT,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "location" VARCHAR(240),
  "coverPhotoId" UUID UNIQUE,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "publicSlug" VARCHAR(120) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3)
);
CREATE TABLE "EventSettings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL UNIQUE,
  "accessEnabled" BOOLEAN NOT NULL DEFAULT false,
  "accessPinHash" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "downloadsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "downloadAllEnabled" BOOLEAN NOT NULL DEFAULT false,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "selfieRetentionMinutes" INTEGER NOT NULL DEFAULT 0,
  "searchResultTtlMinutes" INTEGER NOT NULL DEFAULT 60,
  "similarityThreshold" DECIMAL(4,3) NOT NULL DEFAULT 0.62,
  "consentVersion" VARCHAR(32) NOT NULL DEFAULT '1.0',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Photo" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "originalKey" TEXT NOT NULL UNIQUE,
  "thumbnailKey" TEXT,
  "previewKey" TEXT,
  "originalFilename" TEXT NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "byteSize" BIGINT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sha256" CHAR(64) NOT NULL,
  "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Photo_eventId_sha256_key" UNIQUE ("eventId","sha256")
);
CREATE TABLE "FaceEmbedding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "photoId" UUID NOT NULL,
  "faceIndex" INTEGER NOT NULL,
  "modelName" VARCHAR(100) NOT NULL,
  "modelVersion" VARCHAR(50) NOT NULL,
  "embedding" vector(512) NOT NULL,
  "boundingBox" JSONB NOT NULL,
  "detectionConfidence" DECIMAL(6,5) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceEmbedding_face_model_key" UNIQUE ("photoId","faceIndex","modelName","modelVersion")
);
CREATE TABLE "ProcessingJob" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "photoId" UUID,
  "type" "JobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "payload" JSONB NOT NULL,
  "error" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "GuestSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "status" "GuestSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" CHAR(64),
  "userAgentHash" CHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "GuestConsent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "guestSessionId" UUID NOT NULL,
  "type" "ConsentType" NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "noticeSnapshot" JSONB NOT NULL
);
CREATE TABLE "PhotoSearch" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL,
  "guestSessionId" UUID NOT NULL,
  "status" "SearchStatus" NOT NULL DEFAULT 'PENDING',
  "selfieObjectKey" TEXT,
  "threshold" DECIMAL(4,3) NOT NULL,
  "faceCount" INTEGER,
  "failureCode" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE TABLE "SearchResult" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "searchId" UUID NOT NULL,
  "photoId" UUID NOT NULL,
  "similarity" DECIMAL(7,6) NOT NULL,
  "rank" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchResult_searchId_photoId_key" UNIQUE ("searchId","photoId")
);
CREATE TABLE "DownloadLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studioId" UUID NOT NULL,
  "guestSessionId" UUID,
  "searchId" UUID,
  "photoId" UUID NOT NULL,
  "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "studioId" UUID,
  "eventId" UUID,
  "userId" UUID,
  "guestSessionId" UUID,
  "actorType" "AuditActorType" NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "resourceType" VARCHAR(80) NOT NULL,
  "resourceId" TEXT,
  "metadata" JSONB,
  "ipHash" CHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "RefreshSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "familyId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3)
);
CREATE TABLE "PasswordResetToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioMember" ADD CONSTRAINT "StudioMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSettings" ADD CONSTRAINT "EventSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_coverPhotoId_fkey" FOREIGN KEY ("coverPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FaceEmbedding" ADD CONSTRAINT "FaceEmbedding_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FaceEmbedding" ADD CONSTRAINT "FaceEmbedding_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestConsent" ADD CONSTRAINT "GuestConsent_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoSearch" ADD CONSTRAINT "PhotoSearch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhotoSearch" ADD CONSTRAINT "PhotoSearch_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PhotoSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "PhotoSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "StudioMember_studioId_idx" ON "StudioMember"("studioId");
CREATE INDEX "StudioMember_userId_idx" ON "StudioMember"("userId");
CREATE INDEX "Event_studioId_idx" ON "Event"("studioId");
CREATE INDEX "Event_studioId_status_idx" ON "Event"("studioId","status");
CREATE INDEX "Photo_eventId_idx" ON "Photo"("eventId");
CREATE INDEX "Photo_eventId_status_idx" ON "Photo"("eventId","status");
CREATE INDEX "FaceEmbedding_eventId_idx" ON "FaceEmbedding"("eventId");
CREATE INDEX "FaceEmbedding_photoId_idx" ON "FaceEmbedding"("photoId");
CREATE INDEX "FaceEmbedding_embedding_hnsw_cosine_idx" ON "FaceEmbedding" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);
CREATE INDEX "ProcessingJob_eventId_idx" ON "ProcessingJob"("eventId");
CREATE INDEX "ProcessingJob_status_createdAt_idx" ON "ProcessingJob"("status","createdAt");
CREATE INDEX "GuestSession_eventId_idx" ON "GuestSession"("eventId");
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");
CREATE INDEX "GuestConsent_guestSessionId_idx" ON "GuestConsent"("guestSessionId");
CREATE INDEX "PhotoSearch_eventId_idx" ON "PhotoSearch"("eventId");
CREATE INDEX "PhotoSearch_guestSessionId_idx" ON "PhotoSearch"("guestSessionId");
CREATE INDEX "PhotoSearch_expiresAt_idx" ON "PhotoSearch"("expiresAt");
CREATE INDEX "SearchResult_searchId_rank_idx" ON "SearchResult"("searchId","rank");
CREATE INDEX "DownloadLog_studioId_downloadedAt_idx" ON "DownloadLog"("studioId","downloadedAt");
CREATE INDEX "DownloadLog_guestSessionId_idx" ON "DownloadLog"("guestSessionId");
CREATE INDEX "AuditLog_studioId_createdAt_idx" ON "AuditLog"("studioId","createdAt");
CREATE INDEX "AuditLog_eventId_createdAt_idx" ON "AuditLog"("eventId","createdAt");
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");
CREATE INDEX "RefreshSession_familyId_idx" ON "RefreshSession"("familyId");
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");