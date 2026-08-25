import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.js";
import { env } from "./config/env.js";

export function configureHttpTimeouts(server: Server): Server {
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.timeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

export async function startServer(): Promise<void> {
  const app = createApp();

  await new Promise<void>((resolve, reject) => {
    const server = configureHttpTimeouts(createServer(app));
    server.listen(env.PORT, env.HOST, () => resolve());
    server.once("error", reject);
  });
}

const entryPoint = process.argv[1];
if (entryPoint && fileURLToPath(import.meta.url) === resolve(entryPoint)) {
  void startServer();
}
