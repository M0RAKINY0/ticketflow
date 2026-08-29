CREATE TYPE "OutboxEventType" AS ENUM ('TICKET_EMAIL_REQUESTED');

CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "OutboxEventType" NOT NULL,
    "aggregateId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),
    "lockedAt" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_type_aggregateId_key" ON "OutboxEvent"("type", "aggregateId");
CREATE INDEX "OutboxEvent_publishedAt_nextAttemptAt_lockedAt_idx" ON "OutboxEvent"("publishedAt", "nextAttemptAt", "lockedAt");
