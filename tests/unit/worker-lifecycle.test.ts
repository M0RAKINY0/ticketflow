import { describe, expect, it, vi } from "vitest";

import { startWorkerRuntime } from "../../src/worker.js";

describe("worker lifecycle", () => {
  it("starts resources in dependency order and closes them in reverse order", async () => {
    const calls: string[] = [];
    const dispatcherRun = vi.fn(async () => undefined);
    const runtime = await startWorkerRuntime({
      producerConnection: {
        connect: async () => calls.push("connect producer Redis"),
        quit: async () => calls.push("quit producer Redis"),
      },
      workerConnection: {
        connect: async () => calls.push("connect worker Redis"),
        quit: async () => calls.push("quit worker Redis"),
      },
      queues: {
        close: async () => calls.push("close queues"),
        ticketEmailQueue: { add: async () => undefined },
      },
      verifyDatabase: async () => calls.push("verify PostgreSQL"),
      workers: {
        authWorker: { close: async () => calls.push("close auth worker") },
        ticketWorker: { close: async () => calls.push("close ticket worker") },
      },
      dispatcher: { run: dispatcherRun },
      startWorkers: () => calls.push("start queue workers"),
      startDispatcher: () => calls.push("start outbox dispatcher"),
      flushSentry: async () => calls.push("flush Sentry"),
      disconnectPrisma: async () => calls.push("disconnect Prisma"),
    });

    expect(calls).toEqual([
      "connect producer Redis",
      "connect worker Redis",
      "verify PostgreSQL",
      "start queue workers",
      "start outbox dispatcher",
    ]);

    await runtime.close();
    expect(calls).toEqual([
      "connect producer Redis",
      "connect worker Redis",
      "verify PostgreSQL",
      "start queue workers",
      "start outbox dispatcher",
      "close auth worker",
      "close ticket worker",
      "close queues",
      "quit worker Redis",
      "flush Sentry",
      "disconnect Prisma",
    ]);
  });

  it("runs one idempotent shutdown", async () => {
    const close = vi.fn(async () => undefined);
    const runtime = await startWorkerRuntime({
      producerConnection: { connect: async () => undefined, quit: close },
      workerConnection: { connect: async () => undefined, quit: close },
      queues: { close, ticketEmailQueue: { add: async () => undefined } },
      verifyDatabase: async () => undefined,
      workers: { authWorker: { close }, ticketWorker: { close } },
      dispatcher: { run: async () => undefined },
      startWorkers: () => undefined,
      startDispatcher: () => undefined,
      flushSentry: close,
      disconnectPrisma: close,
    });

    await Promise.all([runtime.close(), runtime.close()]);

    expect(close).toHaveBeenCalledTimes(6);
  });

  it("aborts the dispatcher before closing queue workers", async () => {
    let dispatcherSignal: AbortSignal | undefined;
    let abortedBeforeWorkerClose = false;
    const runtime = await startWorkerRuntime({
      producerConnection: {
        connect: async () => undefined,
        quit: async () => undefined,
      },
      workerConnection: {
        connect: async () => undefined,
        quit: async () => undefined,
      },
      queues: {
        close: async () => undefined,
        ticketEmailQueue: { add: async () => undefined },
      },
      verifyDatabase: async () => undefined,
      workers: {
        authWorker: {
          close: async () => {
            abortedBeforeWorkerClose = dispatcherSignal?.aborted ?? false;
          },
        },
        ticketWorker: { close: async () => undefined },
      },
      dispatcher: {
        run: async (signal) => {
          dispatcherSignal = signal;
        },
      },
      startWorkers: () => undefined,
      startDispatcher: () => undefined,
      flushSentry: async () => undefined,
      disconnectPrisma: async () => undefined,
    });

    await runtime.close();

    expect(abortedBeforeWorkerClose).toBe(true);
  });
});
