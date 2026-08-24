import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().trim().min(1).max(253).default("127.0.0.1"),
  FRONTEND_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(86_400_000)
    .default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(100),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  host: string;
  frontendOrigins: string[];
  rateLimit: {
    windowMs: number;
    limit: number;
  };
};

function parseFrontendOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("FRONTEND_ORIGINS must contain one or more explicit HTTP(S) origins");
  }

  const normalizedOrigins = origins.map((origin) => {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`FRONTEND_ORIGINS contains an invalid origin: ${origin}`);
    }

    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.username ||
      parsedOrigin.password ||
      parsedOrigin.pathname !== "/" ||
      parsedOrigin.search ||
      parsedOrigin.hash
    ) {
      throw new Error(`FRONTEND_ORIGINS contains an invalid origin: ${origin}`);
    }

    return parsedOrigin.origin;
  });

  return [...new Set(normalizedOrigins)];
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedEnvironment = environmentSchema.safeParse(environment);

  if (!parsedEnvironment.success) {
    const fields = parsedEnvironment.error.issues
      .map((issue) => issue.path.join(".") || "environment")
      .join(", ");
    throw new Error(`Invalid backend configuration: ${fields}`);
  }

  if (parsedEnvironment.data.NODE_ENV === "production" && !environment.FRONTEND_ORIGINS) {
    throw new Error("FRONTEND_ORIGINS must be set explicitly in production");
  }

  return {
    nodeEnv: parsedEnvironment.data.NODE_ENV,
    port: parsedEnvironment.data.PORT,
    host: parsedEnvironment.data.HOST,
    frontendOrigins: parseFrontendOrigins(parsedEnvironment.data.FRONTEND_ORIGINS),
    rateLimit: {
      windowMs: parsedEnvironment.data.RATE_LIMIT_WINDOW_MS,
      limit: parsedEnvironment.data.RATE_LIMIT_MAX,
    },
  };
}
