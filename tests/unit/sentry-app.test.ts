import { describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  initializeSentry: vi.fn(),
  setupSentryErrorHandler: vi.fn(),
}));

vi.mock("../../src/infrastructure/sentry.js", () => sentry);

import { createApp } from "../../src/app.js";

describe("Sentry application wiring", () => {
  it("installs Sentry before Ventra's response-producing error handler", () => {
    createApp();

    expect(sentry.setupSentryErrorHandler).toHaveBeenCalledOnce();
  });

  it("initializes Sentry from the preload module", async () => {
    await import("../../src/instrument.js");

    expect(sentry.initializeSentry).toHaveBeenCalledOnce();
  });
});
