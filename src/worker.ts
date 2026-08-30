import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

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
import { flushSentry } from "./infrastructure/sentry.js";

const WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

type ConnectableRedis = Pick<Redis, "connect" | "quit">;
type Closable = { close(): Promise<void> };
type Queues = Pick<
  ReturnType<typeof createEmailQueues>,
  "close" | "ticketEmailQueue"
>;
type RuntimeWorkers = { authWorker: Closable; ticketWorker: Closable };
type Dispatcher = { run(signal: AbortSignal): Promise<void> };

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
    (async () => {
      await workers.authWorker.close();
      await workers.ticketWorker.close();
    })(),
    deadline,
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
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
  const abortController = new AbortController();

  await producerConnection.connect();
  await workerConnection.connect();
  await verifyDatabase();
  const queues =
    dependencies.queues ??
    (dependencies.createQueues ?? createEmailQueues)(
      producerConnection as Redis,
    );
  const workers =
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
  void dispatcher.run(abortController.signal).catch(() => undefined);

  let closePromise: Promise<void> | undefined;
  return {
    close() {
      closePromise ??= (async () => {
        abortController.abort();
        await closeWorkersWithinDeadline(workers);
        await queues.close();
        await workerConnection.quit();
        await flush();
        await disconnect();
      })();
      return closePromise;
    },
  };
}

async function runWorkerProcess(): Promise<void> {
  const runtime = await startWorkerRuntime();
  const shutdown = () => {
    void runtime.close().finally(() => process.exit());
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === resolve(entryPoint)) {
  void runWorkerProcess();
}
