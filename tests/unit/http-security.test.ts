import { createServer } from "node:http";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Env } from "../../src/config/env.js";
import { configureHttpTimeouts } from "../../src/server.js";

const config: Env = {
  NODE_ENV: "test",
  PORT: 4000,
  HOST: "127.0.0.1",
  FRONTEND_ORIGINS: ["http://localhost:5173"],
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 100,
  DATABASE_URL: "postgresql://user:password@localhost:5432/ventra_test",
  TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/ventra_test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4001",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  TICKET_QR_SECRET: "b".repeat(32),
};

describe("HTTP security", () => {
  it("sets security headers and allows configured origins", async () => {
    const response = await request(createApp(config))
      .get("/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rejects unknown browser origins", async () => {
    const response = await request(createApp(config))
      .get("/health")
      .set("Origin", "https://attacker.example");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: "ORIGIN_DENIED",
        message: "Request origin is not allowed",
      },
    });
  });

  it("sets finite Node HTTP timeouts", () => {
    const server = configureHttpTimeouts(createServer());

    expect(server.headersTimeout).toBe(15_000);
    expect(server.requestTimeout).toBe(30_000);
    expect(server.timeout).toBe(30_000);
    expect(server.keepAliveTimeout).toBe(5_000);
  });
});
