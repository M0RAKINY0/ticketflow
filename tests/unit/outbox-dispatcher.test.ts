import { describe, expect, it, vi } from "vitest";

import {
  calculateOutboxRetry,
  createOutboxDispatcher,
  type OutboxRepository,
} from "../../src/infrastructure/outbox/outbox.dispatcher.js";
import { TICKET_JOB_OPTIONS } from "../../src/infrastructure/queues/email-queues.js";

const aggregateId = "4c8fd57d-a993-4bd7-9943-4a6e22f913aa";
const now = new Date("2030-06-15T18:30:00.000Z");

function setup() {
  const repository: OutboxRepository = {
    claimBatch: vi.fn().mockResolvedValue([
      {
        id: "outbox-event-1",
        aggregateId,
        attempts: 0,
      },
    ]),
    markPublished: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const queue = { add: vi.fn().mockResolvedValue(undefined) };
  const dispatcher = createOutboxDispatcher({
    repository,
    queue,
    workerId: "worker-1",
    clock: () => now,
  });

  return { dispatcher, queue, repository };
}

describe("outbox dispatcher", () => {
  it("backs off failed events with a capped exponential delay", () => {
    expect(calculateOutboxRetry(1)).toBe(2_000);
    expect(calculateOutboxRetry(8)).toBe(256_000);
    expect(calculateOutboxRetry(9)).toBe(300_000);
  });

  it("publishes each claimed ticket event with a stable job ID", async () => {
    const { dispatcher, queue, repository } = setup();

    await dispatcher.dispatchOnce();

    expect(queue.add).toHaveBeenCalledWith(
      "send-ticket-confirmation",
      { ticketId: aggregateId },
      { ...TICKET_JOB_OPTIONS, jobId: `ticket-email-${aggregateId}` },
    );
    expect(repository.markPublished).toHaveBeenCalledWith(
      "outbox-event-1",
      now,
    );
  });

  it("records a sanitized retry when queue publication fails", async () => {
    const { dispatcher, queue, repository } = setup();
    queue.add.mockRejectedValueOnce(
      new Error("provider leaked attendee@example.com"),
    );

    await dispatcher.dispatchOnce();

    expect(repository.markFailed).toHaveBeenCalledWith({
      id: "outbox-event-1",
      nextAttemptAt: new Date("2030-06-15T18:30:02.000Z"),
      lastError: "Queue publication failed",
    });
    expect(JSON.stringify(repository.markFailed.mock.calls)).not.toContain(
      "attendee@example.com",
    );
  });

  it("stops its loop as soon as the abort signal fires", async () => {
    const repository: OutboxRepository = {
      claimBatch: vi.fn().mockResolvedValue([]),
      markPublished: vi.fn(),
      markFailed: vi.fn(),
    };
    const controller = new AbortController();
    const wait = vi.fn(async () => controller.abort());
    const dispatcher = createOutboxDispatcher({
      repository,
      queue: { add: vi.fn() },
      workerId: "worker-1",
      wait,
    });

    await dispatcher.run(controller.signal);

    expect(repository.claimBatch).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(1_000, controller.signal);
  });
});
