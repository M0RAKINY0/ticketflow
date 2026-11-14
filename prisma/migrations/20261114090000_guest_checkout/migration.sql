-- A reservation now belongs to a buyer identified by email, with or without
-- an account, and holds one or more tickets. The ticket type moves from the
-- reservation to each ticket.

ALTER TABLE "Reservation" ADD COLUMN "buyerEmail" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "buyerName" TEXT;

UPDATE "Reservation" AS r
SET "buyerEmail" = lower(u."email"), "buyerName" = u."name"
FROM "User" AS u
WHERE u."id" = r."userId";

ALTER TABLE "Reservation" ALTER COLUMN "buyerEmail" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "buyerName" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Ticket" ADD COLUMN "ticketTypeId" UUID;

UPDATE "Ticket" AS t
SET "ticketTypeId" = r."ticketTypeId"
FROM "Reservation" AS r
WHERE r."id" = t."reservationId";

ALTER TABLE "Ticket" ALTER COLUMN "ticketTypeId" SET NOT NULL;

ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_ticketTypeId_fkey";
DROP INDEX "Reservation_ticketTypeId_idx";
ALTER TABLE "Reservation" DROP COLUMN "ticketTypeId";

DROP INDEX "Reservation_userId_idempotencyKey_key";
CREATE UNIQUE INDEX "Reservation_buyerEmail_idempotencyKey_key" ON "Reservation"("buyerEmail", "idempotencyKey");
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");

DROP INDEX "Ticket_reservationId_key";
CREATE INDEX "Ticket_reservationId_idx" ON "Ticket"("reservationId");
CREATE INDEX "Ticket_ticketTypeId_idx" ON "Ticket"("ticketTypeId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
