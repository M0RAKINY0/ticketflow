ALTER TABLE "Reservation" ADD COLUMN "confirmationSentAt" TIMESTAMPTZ(3);
UPDATE "Reservation" r SET "confirmationSentAt" = s.sent FROM (SELECT "reservationId", max("emailSentAt") AS sent FROM "Ticket" GROUP BY "reservationId" HAVING count(*) = count("emailSentAt")) s WHERE r."id" = s."reservationId";
DELETE FROM "OutboxEvent" WHERE "type" = 'TICKET_EMAIL_REQUESTED';
INSERT INTO "OutboxEvent" ("id", "type", "aggregateId") SELECT gen_random_uuid(), 'TICKET_EMAIL_REQUESTED', r."id" FROM "Reservation" r JOIN "Event" e ON e."id" = r."eventId" WHERE r."confirmationSentAt" IS NULL AND r."status" = 'CONFIRMED' AND e."status" = 'PUBLISHED' AND EXISTS (SELECT 1 FROM "Ticket" t WHERE t."reservationId" = r."id");
CREATE INDEX "Reservation_buyerEmail_createdAt_idx" ON "Reservation"("buyerEmail", "createdAt");
