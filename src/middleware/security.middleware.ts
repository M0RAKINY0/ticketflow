import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import type { Env } from "../config/env.js";

export function createSecurityMiddleware(config: Env) {
  const allowedOrigins = new Set(config.FRONTEND_ORIGINS);

  return [
    helmet(),
    cors({
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
      allowedHeaders: ["Content-Type", "Authorization"],
      optionsSuccessStatus: 204,
    }),
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
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
    }),
  ];
}
