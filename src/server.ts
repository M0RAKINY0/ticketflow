import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeAuthOtpProducer } from "./infrastructure/auth.js";
import { connectRedis, disconnectRedis } from "./infrastructure/redis.js";

export function configureHttpTimeouts(server: Server): Server {
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.timeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

export async function startServer(): Promise<void> {
  await connectRedis();
  const app = createApp();

  await new Promise<void>((resolve, reject) => {
    const server = configureHttpTimeouts(createServer(app));
    const shutdown = () =>
      server.close(() => {
        void closeAuthOtpProducer().finally(disconnectRedis);
      });
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    server.listen(env.PORT, env.HOST, () => resolve());
    server.once("error", reject);
  });
}

const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === resolve(entryPoint)) {
  void startServer();
}
