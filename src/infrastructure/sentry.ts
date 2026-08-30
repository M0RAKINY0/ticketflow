import * as Sentry from "@sentry/node";
import type { Express } from "express";

import { env, type Env } from "../config/env.js";
import { AppError } from "../shared/errors.js";

export type SentryOptions = {
  dsn: string;
  environment: Env["NODE_ENV"];
  sendDefaultPii: false;
  tracesSampleRate: 0;
};

export function createSentryOptions(config: Env): SentryOptions | undefined {
  if (!config.SENTRY_DSN || config.NODE_ENV === "test") return undefined;

  return {
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}

function readStatus(error: object): number | undefined {
  for (const key of ["statusCode", "status"] as const) {
    if (key in error) {
      const value = error[key as keyof typeof error];
      if (typeof value === "number") return value;
    }
  }
  return undefined;
}

export function shouldReportError(error: unknown): boolean {
  if (error instanceof AppError) return error.statusCode >= 500;
  if (typeof error !== "object" || error === null) return true;
  if ("code" in error && error.code === "CORS_ORIGIN_DENIED") return false;

  const status = readStatus(error);
  return status === undefined || status >= 500;
}

export function initializeSentry(config: Env = env): void {
  const options = createSentryOptions(config);
  if (options) Sentry.init(options);
}

export function setupSentryErrorHandler(app: Express): void {
  if (!Sentry.isInitialized()) return;
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError: shouldReportError,
  });
}

export type BackgroundJobFailure = {
  queueName: string;
  jobName: string;
  jobId: string | undefined;
  attemptsMade: number;
  attempts: number | undefined;
  ticketId?: string;
  error?: unknown;
  jobData?: unknown;
};

export function reportBackgroundJobFailure(input: BackgroundJobFailure): void {
  if (!Sentry.isInitialized()) return;

  const context: {
    jobId: string | undefined;
    attemptsMade: number;
    attempts: number | undefined;
    ticketId?: string;
  } = {
    jobId: input.jobId,
    attemptsMade: input.attemptsMade,
    attempts: input.attempts,
  };
  if (input.ticketId) context.ticketId = input.ticketId;

  Sentry.captureException(new Error("Background email job failed"), {
    tags: {
      queue: input.queueName,
      job: input.jobName,
    },
    contexts: { background_job: context },
  });
}

export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (Sentry.isInitialized()) await Sentry.flush(timeoutMs);
}
