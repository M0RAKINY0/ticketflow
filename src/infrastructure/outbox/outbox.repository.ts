import { prisma } from "../prisma.js";
import {
  QUEUE_PUBLICATION_FAILURE,
  type ClaimedOutboxEvent,
  type OutboxRepository,
} from "./outbox.dispatcher.js";

export const outboxRepository: OutboxRepository = {
  async claimBatch({ workerId, now, leaseExpiredAt, limit }) {
    const batchLimit = Math.max(1, Math.min(Math.floor(limit), 100));

    return prisma.$transaction(async (transaction) => {
      const events = await transaction.$queryRaw<ClaimedOutboxEvent[]>`
        SELECT "id", "aggregateId", "attempts"
        FROM "OutboxEvent"
        WHERE "publishedAt" IS NULL
          AND "nextAttemptAt" <= ${now}
          AND ("lockedAt" IS NULL OR "lockedAt" < ${leaseExpiredAt})
        ORDER BY "createdAt" ASC
        LIMIT ${batchLimit}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length > 0) {
        await transaction.outboxEvent.updateMany({
          where: { id: { in: events.map((event) => event.id) } },
          data: { lockedAt: now, lockedBy: workerId },
        });
      }

      return events;
    });
  },

  async markPublished(id, publishedAt) {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        publishedAt,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  },

  async markFailed({ id, nextAttemptAt }) {
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        nextAttemptAt,
        lastError: QUEUE_PUBLICATION_FAILURE,
        lockedAt: null,
        lockedBy: null,
      },
    });
  },
};
