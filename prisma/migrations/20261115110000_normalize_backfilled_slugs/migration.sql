-- Truncation in the initial backfill can leave a hyphen before the UUID separator.
-- UUID suffixes preserve uniqueness when repeated hyphens are collapsed.
UPDATE "Event"
SET "slug" = regexp_replace("slug", '-{2,}', '-', 'g')
WHERE "slug" LIKE '%--%';
