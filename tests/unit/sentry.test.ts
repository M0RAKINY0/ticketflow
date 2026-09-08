import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "../../src/config/env.js";
import {
  createSentryOptions,
  initializeSentry,
  reportBackgroundJobFailure,
  reportQueueWorkerFailure,
  reportWorkerRuntimeFailure,
  setupSentryErrorHandler,
  shouldReportError,
} from "../../src/infrastructure/sentry.js";
import { AppError } from "../../src/shared/errors.js";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  isInitialized: vi.fn(),
  captureException: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
}));

vi.mock("@sentry/node", () => sentry);

const config: Env = {
  NODE_ENV: "production",
  PORT: 4000,
  HOST: "127.0.0.1",
  FRONTEND_ORIGINS: ["https://ventra.example"],
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 100,
  DATABASE_URL: "postgresql://user:password@localhost:5432/ventra",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://api.ventra.example",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  TICKET_QR_SECRET: "b".repeat(32),
  SENTRY_DSN: "https://public-key@o123456.ingest.sentry.io/123456",
};

describe("Sentry configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables error reporting without PII or performance traces", () => {
    expect(createSentryOptions(config)).toEqual({
      dsn: config.SENTRY_DSN,
      environment: "production",
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
  });

  it("stays disabled without a DSN and during tests", () => {
    expect(createSentryOptions({ ...config, SENTRY_DSN: undefined })).toBe(
      undefined,
    );
    expect(createSentryOptions({ ...config, NODE_ENV: "test" })).toBe(
      undefined,
    );
  });

  it("initializes the SDK only when reporting is configured", () => {
    initializeSentry(config);
    initializeSentry({ ...config, SENTRY_DSN: undefined });
    initializeSentry({ ...config, NODE_ENV: "test" });

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.init).toHaveBeenCalledWith(createSentryOptions(config));
  });

  it("installs the Express error handler only after initialization", () => {
    const app = { use: vi.fn() } as unknown as Express;
    sentry.isInitialized.mockReturnValueOnce(false).mockReturnValueOnce(true);

    setupSentryErrorHandler(app);
    setupSentryErrorHandler(app);

    expect(sentry.setupExpressErrorHandler).toHaveBeenCalledOnce();
    expect(sentry.setupExpressErrorHandler).toHaveBeenCalledWith(app, {
      shouldHandleError: shouldReportError,
    });
  });
});

describe("Sentry error filtering", () => {
  it("does not report expected application and HTTP client errors", () => {
    expect(shouldReportError(new AppError(404, "NOT_FOUND", "Not found"))).toBe(
      false,
    );
    expect(shouldReportError({ status: 400 })).toBe(false);
    expect(shouldReportError({ statusCode: 413 })).toBe(false);
    expect(shouldReportError({ code: "CORS_ORIGIN_DENIED" })).toBe(false);
  });

  it("reports unexpected errors and explicit server failures", () => {
    expect(shouldReportError(new Error("database unavailable"))).toBe(true);
    expect(shouldReportError({ status: 500 })).toBe(true);
    expect(
      shouldReportError(new AppError(503, "UNAVAILABLE", "Unavailable")),
    ).toBe(true);
  });
});

describe("background job reporting", () => {
  it("reports only the safe job identifiers", () => {
    sentry.isInitialized.mockReturnValue(true);

    reportBackgroundJobFailure({
      queueName: "ventra-ticket-email",
      jobName: "send-ticket-confirmation",
      jobId: "ticket-email-7f24d1ca-b9f0-4c0d-840f-2c3a20c0063f",
      attemptsMade: 5,
      attempts: 5,
      ticketId: "7f24d1ca-b9f0-4c0d-840f-2c3a20c0063f",
      error: new Error("recipient person@example.com otp 123456"),
      jobData: {
        email: "person@example.com",
        otp: "123456",
        qrPayload: "private-payload",
        qrCodeDataUrl: "data:image/png;base64,private-image",
      },
    });

    expect(sentry.captureException).toHaveBeenCalledOnce();
    const [error, context] = sentry.captureException.mock.calls[0] ?? [];
    expect(error).toEqual(new Error("Background email job failed"));
    expect(context).toEqual({
      tags: {
        queue: "ventra-ticket-email",
        job: "send-ticket-confirmation",
      },
      contexts: {
        background_job: {
          jobId: "ticket-email-7f24d1ca-b9f0-4c0d-840f-2c3a20c0063f",
          attemptsMade: 5,
          attempts: 5,
          ticketId: "7f24d1ca-b9f0-4c0d-840f-2c3a20c0063f",
        },
      },
    });
    expect(JSON.stringify(sentry.captureException.mock.calls[0])).not.toMatch(
      /person@example\\.com|123456|private-payload|private-image|jobData/,
    );
  });

  it("does not capture background failures before Sentry is initialized", () => {
    sentry.captureException.mockClear();
    sentry.isInitialized.mockReturnValue(false);

    reportBackgroundJobFailure({
      queueName: "ventra-auth-email",
      jobName: "send-verification-otp",
      jobId: "otp-7f24d1ca-b9f0-4c0d-840f-2c3a20c0063f",
      attemptsMade: 3,
      attempts: 3,
    });

    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports operational worker failures without the original error", () => {
    sentry.captureException.mockClear();
    sentry.isInitialized.mockReturnValue(true);

    reportWorkerRuntimeFailure("outbox-dispatcher");

    expect(sentry.captureException).toHaveBeenCalledWith(
      new Error("Background worker operation failed"),
      { tags: { operation: "outbox-dispatcher" } },
    );
  });

  it("reports a queue worker error without its provider error", () => {
    sentry.captureException.mockClear();
    sentry.isInitialized.mockReturnValue(true);

    reportQueueWorkerFailure("ventra-auth-email");

    expect(sentry.captureException).toHaveBeenCalledWith(
      new Error("Background queue worker failed"),
      { tags: { queue: "ventra-auth-email", operation: "worker-error" } },
    );
  });
});
