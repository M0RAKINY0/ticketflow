import "dotenv/config";
import { z } from "zod";

import { selectMigrationDatabaseUrl } from "./database-url.js";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  HOST: z.string().trim().min(1).max(253).default("127.0.0.1"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(86_400_000)
    .default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(100),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  TICKET_QR_SECRET: z.string().min(32),
  SENTRY_DSN: z.url().optional(),
});

export type Env = Omit<
  z.infer<typeof environmentSchema>,
  "DATABASE_URL" | "FRONTEND_ORIGINS"
> & {
  DATABASE_URL: string;
  FRONTEND_ORIGINS: string[];
};

function parseFrontendOrigins(value: string): string[] {
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("FRONTEND_ORIGINS must contain explicit HTTP(S) origins");
  }

  return [
    ...new Set(
      origins.map((origin) => {
        const url = new URL(origin);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        ) {
          throw new Error(`Invalid frontend origin: ${origin}`);
        }
        return url.origin;
      }),
    ),
  ];
}

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const parsed = environmentSchema.parse(input);

  if (parsed.NODE_ENV === "production" && !input.FRONTEND_ORIGINS) {
    throw new Error("FRONTEND_ORIGINS must be set in production");
  }

  return {
    ...parsed,
    DATABASE_URL: selectMigrationDatabaseUrl(parsed),
    FRONTEND_ORIGINS: parseFrontendOrigins(parsed.FRONTEND_ORIGINS),
  };
}

export const env = parseEnv(process.env);
