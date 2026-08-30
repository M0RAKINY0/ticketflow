import type { JobsOptions } from "bullmq";

import { TICKET_JOB_OPTIONS } from "../queues/email-queues.js";
import type { TicketEmailJob } from "../queues/contracts.js";

export const QUEUE_PUBLICATION_FAILURE = "Queue publication failed";

export type ClaimedOutboxEvent = {
  id: string;
  aggregateId: string;
  attempts: number;
  lockedAt: Date;
  lockedBy: string;
};

export type OutboxRepository = {
  claimBatch(input: {
    workerId: string;
    now: Date;
    leaseExpiredAt: Date;
    limit: number;
  }): Promise<ClaimedOutboxEvent[]>;
  markPublished(event: ClaimedOutboxEvent, publishedAt: Date): Promise<boolean>;
  markFailed(input: {
    event: ClaimedOutboxEvent;
    nextAttemptAt: Date;
    lastError: typeof QUEUE_PUBLICATION_FAILURE;
  }): Promise<boolean>;
};

type TicketEmailQueue = {
  add(
    name: string,
    data: TicketEmailJob,
    options: JobsOptions,
  ): Promise<unknown>;
};

type Wait = (intervalMs: number, signal: AbortSignal) => Promise<void>;

const DEFAULT_BATCH_LIMIT = 25;
const DEFAULT_INTERVAL_MS = 1_000;
const LEASE_DURATION_MS = 30_000;

function waitForInterval(
  intervalMs: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, intervalMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

export function calculateOutboxRetry(attempts: number): number {
  return Math.min(2 ** attempts * 1_000, 300_000);
}

export function createOutboxDispatcher({
  repository,
  queue,
  workerId,
  clock = () => new Date(),
  wait = waitForInterval,
}: {
  repository: OutboxRepository;
  queue: TicketEmailQueue;
  workerId: string;
  clock?: () => Date;
  wait?: Wait;
}) {
  async function dispatchOnce(limit = DEFAULT_BATCH_LIMIT): Promise<void> {
    const now = clock();
    const claimedEvents = await repository.claimBatch({
      workerId,
      now,
      leaseExpiredAt: new Date(now.getTime() - LEASE_DURATION_MS),
      limit,
    });

    await Promise.all(
      claimedEvents.map(async (event) => {
        try {
          await queue.add(
            "send-ticket-confirmation",
            { ticketId: event.aggregateId },
            {
              ...TICKET_JOB_OPTIONS,
              jobId: `ticket-email-${event.aggregateId}`,
            },
          );
          await repository.markPublished(event, clock());
        } catch {
          const failedAt = clock();
          await repository.markFailed({
            event,
            nextAttemptAt: new Date(
              failedAt.getTime() + calculateOutboxRetry(event.attempts + 1),
            ),
            lastError: QUEUE_PUBLICATION_FAILURE,
          });
        }
      }),
    );
  }

  async function run(
    signal: AbortSignal,
    intervalMs = DEFAULT_INTERVAL_MS,
  ): Promise<void> {
    while (!signal.aborted) {
      await dispatchOnce();
      if (!signal.aborted) await wait(intervalMs, signal);
    }
  }

  return { dispatchOnce, run };
}
