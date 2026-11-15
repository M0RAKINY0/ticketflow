ALTER TABLE "Event" ADD COLUMN "slug" TEXT;
UPDATE "Event" SET "slug" = COALESCE(NULLIF(left(trim(both '-' from regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g')), 60), ''), 'event') || '-' || "id"::text;
ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
ALTER TABLE "Ticket" ADD COLUMN "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "Ticket" t SET "unitPrice" = tt."price" FROM "TicketType" tt WHERE t."ticketTypeId" = tt."id";
