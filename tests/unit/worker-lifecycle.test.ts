import { describe, expect, it, vi } from "vitest";

import { startWorkerRuntime } from "../../src/worker.js";

describe("worker lifecycle", () => {
  it.each([
    [
      "worker Redis",
      "worker-connect",
      ["quit worker Redis", "quit producer Redis"],
    ],
    [
      "PostgreSQL",
      "database",
      ["quit worker Redis", "quit producer Redis", "disconnect Prisma"],
    ],
    [
      "queue setup",
      "queues",
      ["quit worker Redis", "quit producer Redis", "disconnect Prisma"],
    ],
    [
      "worker setup",
      "workers",
      ["close queues", "quit worker Redis", "disconnect Prisma"],
    ],
    [
      "dispatcher setup",
      "dispatcher",
      [
        "close auth worker",
        "close ticket worker",
        "close queues",
        "quit worker Redis",
        "disconnect Prisma",
      ],
    ],
  ])(
    "rolls back acquired resources when %s setup fails",
    async (_, stage, cleanup) => {
      const calls: string[] = [];
      const failure = new Error("startup failed");
      const failAt = (name: string) => {
        if (stage === name) throw failure;
      };
      const connection = (name: string) => ({
        connect: async () => {
          calls.push(`connect ${name} Redis`);
          failAt(name === "worker" ? "worker-connect" : "producer-connect");
        },
        quit: async () => calls.push(`quit ${name} Redis`),
      });
      const queues = {
        close: async () => calls.push("close queues"),
        ticketEmailQueue: { add: async () => undefined },
      };
      const workers = {
        authWorker: { close: async () => calls.push("close auth worker") },
        ticketWorker: { close: async () => calls.push("close ticket worker") },
      };

      await expect(
        startWorkerRuntime({
          producerConnection: connection("producer"),
          workerConnection: connection("worker"),
          verifyDatabase: async () => {
            calls.push("verify PostgreSQL");
            failAt("database");
          },
          createQueues: () => {
            calls.push("create queues");
            failAt("queues");
            return queues;
          },
          createWorkers: () => {
            calls.push("create workers");
            failAt("workers");
            return workers;
          },
          createDispatcher: () => {
            calls.push("create dispatcher");
            failAt("dispatcher");
            return { run: async () => undefined };
          },
          disconnectPrisma: async () => calls.push("disconnect Prisma"),
        }),
      ).rejects.toBe(failure);

      expect(calls.slice(-cleanup.length)).toEqual(cleanup);
    },
  );
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

  it("continues cleanup after a worker close timeout and rejects afterwards", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const runtime = await startWorkerRuntime({
      producerConnection: {
        connect: async () => undefined,
        quit: async () => undefined,
      },
      workerConnection: {
        connect: async () => undefined,
        quit: async () => calls.push("quit worker Redis"),
      },
      queues: {
        close: async () => calls.push("close queues"),
        ticketEmailQueue: { add: async () => undefined },
      },
      verifyDatabase: async () => undefined,
      workers: {
        authWorker: { close: async () => new Promise<void>(() => undefined) },
        ticketWorker: { close: async () => calls.push("close ticket worker") },
      },
      dispatcher: { run: async () => undefined },
      startWorkers: () => undefined,
      startDispatcher: () => undefined,
      flushSentry: async () => calls.push("flush Sentry"),
      disconnectPrisma: async () => calls.push("disconnect Prisma"),
    });

    const closing = runtime.close();
    const closingAssertion = expect(closing).rejects.toThrow(
      "Worker runtime shutdown failed",
    );
    await vi.advanceTimersByTimeAsync(30_000);

    await closingAssertion;
    expect(calls).toEqual([
      "close queues",
      "quit worker Redis",
      "flush Sentry",
      "disconnect Prisma",
    ]);
    vi.useRealTimers();
  });

  it("restarts a rejected dispatcher loop after a bounded delay", async () => {
    const waitForRestart = vi.fn(async () => undefined);
    const reportOperationalFailure = vi.fn();
    let calls = 0;
    let signal: AbortSignal | undefined;
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
        authWorker: { close: async () => undefined },
        ticketWorker: { close: async () => undefined },
      },
      dispatcher: {
        run: async (receivedSignal) => {
          calls += 1;
          signal = receivedSignal;
          if (calls === 1) throw new Error("person@example.com 123456");
          await new Promise<void>((resolve) => {
            receivedSignal.addEventListener("abort", () => resolve(), {
              once: true,
            });
          });
        },
      },
      startWorkers: () => undefined,
      startDispatcher: () => undefined,
      waitForDispatcherRestart: waitForRestart,
      reportOperationalFailure,
      flushSentry: async () => undefined,
      disconnectPrisma: async () => undefined,
    });

    await vi.waitFor(() => expect(calls).toBe(2));
    expect(waitForRestart).toHaveBeenCalledOnce();
    expect(reportOperationalFailure).toHaveBeenCalledWith("outbox-dispatcher");
    expect(signal?.aborted).toBe(false);

    await runtime.close();
  });
});
