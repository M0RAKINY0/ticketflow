import express, { type Express } from "express";
import cookieParser from "cookie-parser";

import { errorHandler } from "./middleware/error.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());
  app.use(apiRouter);
  app.use(errorHandler);

  return app;
}
