import { strict as assert } from "node:assert";
import { once } from "node:events";
import { type Server } from "node:http";
import { connect, type Socket } from "node:net";
import { test } from "node:test";

import { createApp } from "../app.js";
import { loadConfig, type AppConfig } from "../config.js";
import {
  createHttpServer,
  DEFAULT_HTTP_TIMEOUTS,
  type HttpTimeouts,
} from "../server.js";

const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  frontendOrigins: ["http://localhost:5173"],
  rateLimit: {
    windowMs: 60_000,
    limit: 100,
  },
};

const shortTimeouts: HttpTimeouts = {
  headersTimeout: 100,
  requestTimeout: 200,
  timeout: 1_000,
  keepAliveTimeout: 50,
};

async function startTestServer(
  config: AppConfig = testConfig,
  registerRoutes?: Parameters<typeof createApp>[1],
  timeouts: HttpTimeouts = DEFAULT_HTTP_TIMEOUTS,
) {
  const server = createHttpServer(config, registerRoutes, timeouts);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopTestServer(server: Server) {
  server.close();
  await once(server, "close");
}

async function openRawSocket(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const socket = connect(address.port, "127.0.0.1");
  await once(socket, "connect");
  return socket;
}

function waitForSocketClose(socket: Socket, timeoutMs = 2_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Socket did not close within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once("close", () => {
      clearTimeout(timer);
      resolve(Date.now() - startedAt);
    });
    socket.once("error", () => {
      // The server may reset the socket as part of closing it.
    });
  });
}

test("sets secure headers and serves the health probe", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await stopTestServer(server);
  }
});

test("sets explicit Node HTTP timeout defaults", () => {
  const server = createHttpServer(testConfig);

  assert.equal(server.headersTimeout, 15_000);
  assert.equal(server.requestTimeout, 30_000);
  assert.equal(server.timeout, 30_000);
  assert.equal(server.keepAliveTimeout, 5_000);
});

test("closes incomplete headers at the HTTP boundary", async () => {
  const { server } = await startTestServer(testConfig, undefined, shortTimeouts);
  const socket = await openRawSocket(server);

  try {
    const closed = waitForSocketClose(socket);
    socket.write("GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Slow: ");

    assert.ok((await closed) < 1_500);
  } finally {
    socket.destroy();
    await stopTestServer(server);
  }
});

test("closes a slow request body at the HTTP boundary", async () => {
  const { server } = await startTestServer(testConfig, undefined, shortTimeouts);
  const socket = await openRawSocket(server);

  try {
    const closed = waitForSocketClose(socket);
    socket.write(
      "POST /health HTTP/1.1\r\n" +
        "Host: 127.0.0.1\r\n" +
        "Content-Type: application/json\r\n" +
        "Content-Length: 100\r\n" +
        "Connection: close\r\n\r\n" +
        "{",
    );

    assert.ok((await closed) < 1_500);
  } finally {
    socket.destroy();
    await stopTestServer(server);
  }
});

test("allows configured browser origins and rejects unknown origins", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const allowedResponse = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(allowedResponse.headers.get("access-control-allow-origin"), "http://localhost:5173");

    const rejectedResponse = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://attacker.example" },
    });
    assert.equal(rejectedResponse.status, 403);
    assert.equal(rejectedResponse.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await rejectedResponse.json(), { error: "Request origin is not allowed" });
  } finally {
    await stopTestServer(server);
  }
});

test("returns safe errors for malformed and oversized JSON", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const malformedResponse = await fetch(`${baseUrl}/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{\"incomplete\":",
    });
    assert.equal(malformedResponse.status, 400);
    assert.deepEqual(await malformedResponse.json(), { error: "Malformed JSON request" });

    const oversizedResponse = await fetch(`${baseUrl}/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(1_048_576) }),
    });
    assert.equal(oversizedResponse.status, 413);
    assert.deepEqual(await oversizedResponse.json(), { error: "Request body is too large" });
  } finally {
    await stopTestServer(server);
  }
});

test("applies the request rate limit", async () => {
  const { server, baseUrl } = await startTestServer({
    ...testConfig,
    rateLimit: { windowMs: 60_000, limit: 1 },
  });

  try {
    assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    const limitedResponse = await fetch(`${baseUrl}/health`);
    assert.equal(limitedResponse.status, 429);
    assert.deepEqual(await limitedResponse.json(), {
      error: "Too many requests. Try again later.",
    });
  } finally {
    await stopTestServer(server);
  }
});

test("does not expose details for unknown routes", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
  } finally {
    await stopTestServer(server);
  }
});

test("does not expose unexpected error details", async () => {
  const { server, baseUrl } = await startTestServer(testConfig, (app) => {
    app.get("/error", (_request, _response, next) => {
      next(new Error("database password should stay on the server"));
    });
  });

  try {
    const response = await fetch(`${baseUrl}/error`);
    const responseBody = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(responseBody, { error: "Internal server error" });
    assert.equal(JSON.stringify(responseBody).includes("database"), false);
  } finally {
    await stopTestServer(server);
  }
});

test("validates explicit production origins", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    PORT: "4000",
    HOST: "127.0.0.1",
    FRONTEND_ORIGINS: "https://ventra.example, https://ventra.example/",
  });

  assert.deepEqual(config.frontendOrigins, ["https://ventra.example"]);
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", PORT: "4000", HOST: "127.0.0.1" }),
    /FRONTEND_ORIGINS must be set explicitly in production/,
  );
  assert.throws(
    () => loadConfig({ NODE_ENV: "test", FRONTEND_ORIGINS: "*" }),
    /FRONTEND_ORIGINS must contain one or more explicit HTTP\(S\) origins/,
  );
});
