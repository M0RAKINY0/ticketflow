CREATE TYPE "EventCategory" AS ENUM (
  'MUSIC',
  'BUSINESS',
  'TECHNOLOGY',
  'ARTS_CULTURE',
  'FOOD_DRINK',
  'SPORTS_FITNESS',
  'COMMUNITY',
  'EDUCATION',
  'OTHER'
);

ALTER TABLE "Event"
  ADD COLUMN "category" "EventCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "coverImageUrl" TEXT,
  ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Unknown',
  ADD COLUMN "countryCode" CHAR(2) NOT NULL DEFAULT 'US',
  ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE "Event"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "city" DROP DEFAULT,
  ALTER COLUMN "countryCode" DROP DEFAULT,
  ALTER COLUMN "currency" DROP DEFAULT,
  ALTER COLUMN "timezone" DROP DEFAULT;

CREATE INDEX "Event_status_category_startsAt_idx"
  ON "Event"("status", "category", "startsAt");

CREATE INDEX "Event_status_countryCode_startsAt_idx"
  ON "Event"("status", "countryCode", "startsAt");
