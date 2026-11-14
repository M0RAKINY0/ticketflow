import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import type { Env } from "../config/env.js";

export function createRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again later.",
        },
      });
    },
  });
}

export function createSecurityMiddleware(config: Env) {
  const allowedOrigins = new Set(config.FRONTEND_ORIGINS);

  return [
    helmet(),
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        const error = new Error("Request origin is not allowed") as Error & {
          code: string;
          status: number;
        };
        error.code = "CORS_ORIGIN_DENIED";
        error.status = 403;
        callback(error);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      optionsSuccessStatus: 204,
    }),
    createRateLimiter(config.RATE_LIMIT_WINDOW_MS, config.RATE_LIMIT_MAX),
  ];
}
