import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";

import { env, type Env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createSecurityMiddleware } from "./middleware/security.middleware.js";
import { apiRouter } from "./routes/index.js";
import { auth, type Auth } from "./infrastructure/auth.js";
import { setupSentryErrorHandler } from "./infrastructure/sentry.js";

export function createApp(
  config: Env = env,
  authInstance: Auth = auth,
): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(...createSecurityMiddleware(config));
  app.all("/api/v1/auth/*splat", toNodeHandler(authInstance));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(apiRouter);
  app.use((_request, response) => {
    response
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
  setupSentryErrorHandler(app);
  app.use(errorHandler);

  return app;
}
