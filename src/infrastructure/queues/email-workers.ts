import { UnrecoverableError, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";

import { ticketEmailSender, verificationEmailSender } from "../email.js";
import { reportBackgroundJobFailure } from "../sentry.js";
import { createOtpProcessor } from "../../modules/notifications/otp.processor.js";
import { createTicketEmailProcessor } from "../../modules/notifications/ticket-email.processor.js";
import { ticketEmailRepository } from "../../modules/notifications/ticket-email.repository.js";
import {
  AUTH_EMAIL_QUEUE,
  TICKET_EMAIL_QUEUE,
  type OtpDeliveryJob,
  type TicketEmailJob,
} from "./contracts.js";

const QUEUE_PREFIX = "ventra:queue";

type FailureJob = Job<unknown>;

function reportTerminalFailure(
  queueName: string,
  job: FailureJob,
  error: Error,
) {
  const attempts = job.opts.attempts ?? 1;
  if (!(error instanceof UnrecoverableError) && job.attemptsMade < attempts) {
    return;
  }

  const ticketId =
    queueName === TICKET_EMAIL_QUEUE &&
    typeof job.data === "object" &&
    job.data !== null &&
    "ticketId" in job.data &&
    typeof job.data.ticketId === "string"
      ? job.data.ticketId
      : undefined;
  reportBackgroundJobFailure({
    queueName,
    jobName: job.name,
    jobId: job.id,
    attemptsMade: job.attemptsMade,
    attempts,
    error,
    ...(ticketId ? { ticketId } : {}),
  });
}

export function createEmailWorkers({
  connection,
  otpSecret,
}: {
  connection: Redis;
  otpSecret: string;
}) {
  const authWorker = new Worker<OtpDeliveryJob>(
    AUTH_EMAIL_QUEUE,
    createOtpProcessor({ secret: otpSecret, sender: verificationEmailSender }),
    { connection, prefix: QUEUE_PREFIX },
  );
  const ticketWorker = new Worker<TicketEmailJob>(
    TICKET_EMAIL_QUEUE,
    createTicketEmailProcessor({
      repository: ticketEmailRepository,
      sender: ticketEmailSender,
    }),
    { connection, prefix: QUEUE_PREFIX },
  );

  authWorker.on("failed", (job, error) => {
    if (job) reportTerminalFailure(AUTH_EMAIL_QUEUE, job, error);
  });
  ticketWorker.on("failed", (job, error) => {
    if (job) reportTerminalFailure(TICKET_EMAIL_QUEUE, job, error);
  });

  return { authWorker, ticketWorker };
}
