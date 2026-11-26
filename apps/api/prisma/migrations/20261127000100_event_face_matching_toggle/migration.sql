-- Existing events start disabled for guest matching. Private owner/admin
-- searches are independent of this event-scoped guest control.
ALTER TABLE "EventSettings"
  ADD COLUMN "faceMatchingEnabled" BOOLEAN NOT NULL DEFAULT false;
