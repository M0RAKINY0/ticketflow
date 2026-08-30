import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Redis } from "ioredis";

import { env } from "./config/env.js";
import { createOutboxDispatcher } from "./infrastructure/outbox/outbox.dispatcher.js";
import { outboxRepository } from "./infrastructure/outbox/outbox.repository.js";
import { prisma } from "./infrastructure/prisma.js";
import {
  createQueueProducerConnection,
  createQueueWorkerConnection,
} from "./infrastructure/queues/connections.js";
import { createEmailQueues } from "./infrastructure/queues/email-queues.js";
import { createEmailWorkers } from "./infrastructure/queues/email-workers.js";
import {
  flushSentry,
  reportWorkerRuntimeFailure,
} from "./infrastructure/sentry.js";

const WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

type ConnectableRedis = Pick<Redis, "connect" | "quit">;
type Closable = { close(): Promise<void> };
type Queues = Pick<
  ReturnType<typeof createEmailQueues>,
  "close" | "ticketEmailQueue"
>;
type RuntimeWorkers = { authWorker: Closable; ticketWorker: Closable };
type Dispatcher = { run(signal: AbortSignal): Promise<void> };
type OperationalReporter = (
  operation: "outbox-dispatcher" | "worker-shutdown",
) => void;
type DispatcherRestartWait = (signal: AbortSignal) => Promise<void>;

export type WorkerRuntime = { close(): Promise<void> };

export type WorkerRuntimeDependencies = {
  producerConnection?: ConnectableRedis;
  workerConnection?: ConnectableRedis;
  queues?: Queues;
  workers?: RuntimeWorkers;
  dispatcher?: Dispatcher;
  createQueues?: (connection: Redis) => Queues;
  createWorkers?: (connection: Redis) => RuntimeWorkers;
  createDispatcher?: (queues: Queues) => Dispatcher;
  verifyDatabase?: () => Promise<void>;
  startWorkers?: () => void;
  startDispatcher?: () => void;
  flushSentry?: () => Promise<void>;
  disconnectPrisma?: () => Promise<void>;
  reportOperationalFailure?: OperationalReporter;
  waitForDispatcherRestart?: DispatcherRestartWait;
};

function closeWorkersWithinDeadline(workers: RuntimeWorkers): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Worker shutdown timed out")),
      WORKER_SHUTDOWN_TIMEOUT_MS,
    );
  });

  return Promise.race([
    Promise.all([
      workers.authWorker.close(),
      workers.ticketWorker.close(),
    ]).then(() => undefined),
    deadline,
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function waitForDispatcherRestart(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 1_000);
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

async function superviseDispatcher(
  dispatcher: Dispatcher,
  signal: AbortSignal,
  reportFailure: OperationalReporter,
  waitForRestart: DispatcherRestartWait,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await dispatcher.run(signal);
      if (!signal.aborted) await waitForRestart(signal);
    } catch {
      if (signal.aborted) return;
      reportFailure("outbox-dispatcher");
      await waitForRestart(signal);
    }
  }
}

async function runCleanupSteps(
  steps: Array<() => Promise<void>>,
  reportFailure?: OperationalReporter,
): Promise<unknown[]> {
  const failures: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
      reportFailure?.("worker-shutdown");
    }
  }
  return failures;
}

export async function startWorkerRuntime(
  dependencies: WorkerRuntimeDependencies = {},
): Promise<WorkerRuntime> {
  const producerConnection =
    dependencies.producerConnection ??
    createQueueProducerConnection(env.REDIS_URL);
  const workerConnection =
    dependencies.workerConnection ?? createQueueWorkerConnection(env.REDIS_URL);
  const verifyDatabase =
    dependencies.verifyDatabase ?? (async () => prisma.$queryRaw`SELECT 1`);
  const flush = dependencies.flushSentry ?? (() => flushSentry());
  const disconnect =
    dependencies.disconnectPrisma ?? (() => prisma.$disconnect());
  const reportOperationalFailure =
    dependencies.reportOperationalFailure ?? reportWorkerRuntimeFailure;
  const restartWait =
    dependencies.waitForDispatcherRestart ?? waitForDispatcherRestart;
  const abortController = new AbortController();
  let queues: Queues | undefined;
  let workers: RuntimeWorkers | undefined;
  let producerConnectionAttempted = false;
  let workerConnectionAttempted = false;
  let databaseAttempted = false;

  try {
    producerConnectionAttempted = true;
    await producerConnection.connect();
    workerConnectionAttempted = true;
    await workerConnection.connect();
    databaseAttempted = true;
    await verifyDatabase();
    queues =
      dependencies.queues ??
      (dependencies.createQueues ?? createEmailQueues)(
        producerConnection as Redis,
      );
    workers =
      dependencies.workers ??
      (
        dependencies.createWorkers ??
        ((connection) =>
          createEmailWorkers({ connection, otpSecret: env.BETTER_AUTH_SECRET }))
      )(workerConnection as Redis);
    const dispatcher =
      dependencies.dispatcher ??
      (
        dependencies.createDispatcher ??
        ((queueResources) =>
          createOutboxDispatcher({
            repository: outboxRepository,
            queue: queueResources.ticketEmailQueue,
            workerId: `email-worker-${randomUUID()}`,
          }))
      )(queues);
    dependencies.startWorkers?.();
    dependencies.startDispatcher?.();
    void superviseDispatcher(
      dispatcher,
      abortController.signal,
      reportOperationalFailure,
      restartWait,
    );
  } catch (error) {
    abortController.abort();
    const rollbackSteps: Array<() => Promise<void>> = [];
    if (workers) {
      const startupWorkers = workers;
      rollbackSteps.push(() => closeWorkersWithinDeadline(startupWorkers));
    }
    if (queues) {
      const startupQueues = queues;
      rollbackSteps.push(() => startupQueues.close());
      if (workerConnectionAttempted) {
        rollbackSteps.push(async () => {
          await workerConnection.quit();
        });
      }
    } else {
      if (workerConnectionAttempted) {
        rollbackSteps.push(async () => {
          await workerConnection.quit();
        });
      }
      if (producerConnectionAttempted) {
        rollbackSteps.push(async () => {
          await producerConnection.quit();
        });
      }
    }
    if (databaseAttempted) rollbackSteps.push(disconnect);
    await runCleanupSteps(rollbackSteps);
    throw error;
  }

  if (!queues || !workers) {
    throw new Error("Worker runtime failed to initialize resources");
  }
  const runtimeQueues = queues;
  const runtimeWorkers = workers;

  let closePromise: Promise<void> | undefined;
  return {
    close() {
      closePromise ??= (async () => {
        abortController.abort();
        const failures = await runCleanupSteps(
          [
            () => closeWorkersWithinDeadline(runtimeWorkers),
            () => runtimeQueues.close(),
            async () => {
              await workerConnection.quit();
            },
            flush,
            disconnect,
          ],
          reportOperationalFailure,
        );
        if (failures.length > 0) {
          throw new AggregateError(failures, "Worker runtime shutdown failed");
        }
      })();
      return closePromise;
    },
  };
}

type SignalProcess = {
  once(signal: "SIGINT" | "SIGTERM", handler: () => void): unknown;
  exit(code?: number): never | void;
};

export function installWorkerSignalHandlers(
  runtime: WorkerRuntime,
  processRef: SignalProcess = process,
  reportFailure: OperationalReporter = reportWorkerRuntimeFailure,
): void {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void runtime.close().then(
      () => processRef.exit(0),
      () => {
        reportFailure("worker-shutdown");
        processRef.exit(1);
      },
    );
  };
  processRef.once("SIGINT", shutdown);
  processRef.once("SIGTERM", shutdown);
}

async function runWorkerProcess(): Promise<void> {
  installWorkerSignalHandlers(await startWorkerRuntime());
}

const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === resolve(entryPoint)) {
  void runWorkerProcess();
}
