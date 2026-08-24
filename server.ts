import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";

export type HttpTimeouts = {
  headersTimeout: number;
  requestTimeout: number;
  timeout: number;
  keepAliveTimeout: number;
};

export const DEFAULT_HTTP_TIMEOUTS: HttpTimeouts = {
  headersTimeout: 15_000,
  requestTimeout: 30_000,
  timeout: 30_000,
  keepAliveTimeout: 5_000,
};

export function configureHttpTimeouts(
  server: Server,
  timeouts: HttpTimeouts = DEFAULT_HTTP_TIMEOUTS,
): Server {
  server.headersTimeout = timeouts.headersTimeout;
  server.requestTimeout = timeouts.requestTimeout;
  server.timeout = timeouts.timeout;
  server.keepAliveTimeout = timeouts.keepAliveTimeout;
  return server;
}

export function createHttpServer(
  config: AppConfig,
  registerRoutes?: Parameters<typeof createApp>[1],
  timeouts: HttpTimeouts = DEFAULT_HTTP_TIMEOUTS,
): Server {
  return configureHttpTimeouts(createServer(createApp(config, registerRoutes)), timeouts);
}

function shutdown(server: Server, signal: NodeJS.Signals) {
  server.close((error) => {
    if (error) {
      console.error(`Unable to close the server after ${signal}`, error.message);
      process.exitCode = 1;
      return;
    }

    console.log(`Server stopped after ${signal}`);
  });
}

function startServer() {
  const config = loadConfig();
  const server = createHttpServer(config);

  process.once("SIGINT", () => shutdown(server, "SIGINT"));
  process.once("SIGTERM", () => shutdown(server, "SIGTERM"));

  server.on("error", (error) => {
    console.error("Server failed to start", error.message);
    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    console.log(`Server is running on http://${config.host}:${config.port}`);
  });
}

const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === resolve(entryPoint)) {
  startServer();
}
