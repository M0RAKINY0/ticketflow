import { Queue, type JobsOptions } from "bullmq";
import type { Redis } from "ioredis";

import {
  AUTH_EMAIL_QUEUE,
  TICKET_EMAIL_QUEUE,
  type OtpDeliveryJob,
  type TicketEmailJob,
} from "./contracts.js";

const QUEUE_PREFIX = "ventra:queue";

export const OTP_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "fixed", delay: 1_000 },
  removeOnComplete: true,
  removeOnFail: true,
};

export const TICKET_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800, count: 5_000 },
};

export function createEmailQueues(connection: Redis) {
  const authEmailQueue = new Queue<OtpDeliveryJob>(AUTH_EMAIL_QUEUE, {
    connection,
    prefix: QUEUE_PREFIX,
  });
  const ticketEmailQueue = new Queue<TicketEmailJob>(TICKET_EMAIL_QUEUE, {
    connection,
    prefix: QUEUE_PREFIX,
  });

  return {
    authEmailQueue,
    ticketEmailQueue,
    async close(): Promise<void> {
      await authEmailQueue.close();
      await ticketEmailQueue.close();
      if (connection.status !== "end") await connection.quit();
    },
  };
}
