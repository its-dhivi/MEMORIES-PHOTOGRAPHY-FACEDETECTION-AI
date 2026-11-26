-- Use the conservative threshold selected after checking all detected faces
-- in the sample event. Operators should still calibrate on their own events.
ALTER TABLE "EventSettings" ALTER COLUMN "similarityThreshold" SET DEFAULT 0.64;
UPDATE "EventSettings"
SET "similarityThreshold" = 0.64,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "similarityThreshold" = 0.53;
