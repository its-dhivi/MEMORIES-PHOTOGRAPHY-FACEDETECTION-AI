-- Existing events still carry the previous model's uncalibrated default.
UPDATE "EventSettings"
SET "similarityThreshold" = 0.53,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "similarityThreshold" = 0.62;
