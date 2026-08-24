import express, { type ErrorRequestHandler, type Express } from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { loadConfig, type AppConfig } from "./config.js";

type RequestError = Error & {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
};

function createCorsOptions(config: AppConfig): CorsOptions {
  const allowedOrigins = new Set(config.frontendOrigins);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Request origin is not allowed") as RequestError;
      error.code = "CORS_ORIGIN_DENIED";
      error.statusCode = 403;
      callback(error);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  };
}

const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const requestError = error as RequestError;

  if (requestError.type === "entity.parse.failed") {
    response.status(400).json({ error: "Malformed JSON request" });
    return;
  }

  if (requestError.type === "entity.too.large") {
    response.status(413).json({ error: "Request body is too large" });
    return;
  }

  if (requestError.code === "CORS_ORIGIN_DENIED") {
    response.status(403).json({ error: "Request origin is not allowed" });
    return;
  }

  const statusCode =
    typeof requestError.statusCode === "number"
      ? requestError.statusCode
      : typeof requestError.status === "number"
        ? requestError.status
        : 500;

  if (statusCode >= 400 && statusCode < 500) {
    response.status(statusCode).json({ error: "The request could not be processed" });
    return;
  }

  console.error("Unhandled backend error", error instanceof Error ? error.name : "unknown");
  response.status(500).json({ error: "Internal server error" });
};

export function createApp(
  config: AppConfig = loadConfig(),
  registerRoutes?: (app: Express) => void,
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors(createCorsOptions(config)));
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.limit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_request, response) => {
        response.status(429).json({ error: "Too many requests. Try again later." });
      },
    }),
  );
  app.use(express.json({ limit: "1mb", strict: true }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  registerRoutes?.(app);

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
