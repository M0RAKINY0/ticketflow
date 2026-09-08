import { Redis } from "ioredis";

export function createQueueProducerConnection(url: string): Redis {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

export function createQueueWorkerConnection(url: string): Redis {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
}
