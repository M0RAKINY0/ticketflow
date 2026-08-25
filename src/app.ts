import express, { type Express } from "express";
import cookieParser from "cookie-parser";

import { env, type Env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createSecurityMiddleware } from "./middleware/security.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp(config: Env = env): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(...createSecurityMiddleware(config));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(apiRouter);
  app.use((_request, response) => {
    response
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
  app.use(errorHandler);

  return app;
}
