import type { Redis } from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  workers: [] as Array<{ handlers: Record<string, (error: Error) => void> }>,
  reportQueueWorkerFailure: vi.fn(),
}));

vi.mock("bullmq", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {},
  Worker: class FakeWorker {
    handlers: Record<string, (error: Error) => void> = {};

    constructor() {
      state.workers.push(this);
    }

    on(event: string, handler: (error: Error) => void) {
      this.handlers[event] = handler;
      return this;
    }

    async close() {}
  },
}));

vi.mock("../../src/infrastructure/sentry.js", () => ({
  reportBackgroundJobFailure: vi.fn(),
  reportQueueWorkerFailure: state.reportQueueWorkerFailure,
}));

import { createEmailWorkers } from "../../src/infrastructure/queues/email-workers.js";

describe("email queue workers", () => {
  beforeEach(() => {
    state.workers.length = 0;
    state.reportQueueWorkerFailure.mockClear();
  });

  it("reports Redis worker errors with only the queue identifier", () => {
    createEmailWorkers({
      connection: {} as Redis,
      otpSecret: "a".repeat(32),
    });

    state.workers[0]?.handlers.error?.(
      new Error("person@example.com otp 123456"),
    );
    state.workers[1]?.handlers.error?.(
      new Error("data:image/png;base64,private"),
    );

    expect(state.reportQueueWorkerFailure).toHaveBeenNthCalledWith(
      1,
      "ventra-auth-email",
    );
    expect(state.reportQueueWorkerFailure).toHaveBeenNthCalledWith(
      2,
      "ventra-ticket-email",
    );
    expect(
      JSON.stringify(state.reportQueueWorkerFailure.mock.calls),
    ).not.toMatch(/person@example\.com|123456|private/);
  });
});
