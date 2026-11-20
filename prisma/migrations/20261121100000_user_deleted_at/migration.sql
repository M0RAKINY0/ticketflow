-- Deleted accounts keep their row with personal details scrubbed.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
