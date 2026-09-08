import { prisma } from "../prisma.js";
import {
  QUEUE_PUBLICATION_FAILURE,
  type ClaimedOutboxEvent,
  type OutboxRepository,
} from "./outbox.dispatcher.js";

type OutboxDatabase = Pick<typeof prisma, "$transaction" | "outboxEvent">;

export function createOutboxRepository(
  database: OutboxDatabase = prisma,
): OutboxRepository {
  return {
    async claimBatch({ workerId, now, leaseExpiredAt, limit }) {
      const batchLimit = Math.max(1, Math.min(Math.floor(limit), 100));

      return database.$transaction(async (transaction) => {
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

        return events.map((event) => ({
          ...event,
          lockedAt: now,
          lockedBy: workerId,
        }));
      });
    },

    async markPublished(event, publishedAt) {
      const result = await database.outboxEvent.updateMany({
        where: {
          id: event.id,
          publishedAt: null,
          lockedAt: event.lockedAt,
          lockedBy: event.lockedBy,
        },
        data: {
          publishedAt,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
      });
      return result.count === 1;
    },

    async markFailed({ event, nextAttemptAt }) {
      const result = await database.outboxEvent.updateMany({
        where: {
          id: event.id,
          publishedAt: null,
          lockedAt: event.lockedAt,
          lockedBy: event.lockedBy,
        },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt,
          lastError: QUEUE_PUBLICATION_FAILURE,
          lockedAt: null,
          lockedBy: null,
        },
      });
      return result.count === 1;
    },
  };
}

export const outboxRepository = createOutboxRepository();
