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
  RESERVATION_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(20),
  TURNSTILE_SECRET_KEY: z.string().trim().min(1).optional(),
  TURNSTILE_HOSTNAMES: z.string().trim().min(1).optional(),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  TICKET_QR_SECRET: z.string().min(32),
  // Signs guest reservation links. Kept apart from TICKET_QR_SECRET so
  // rotating one never invalidates the other.
  RESERVATION_ACCESS_SECRET: z.string().min(32),
  REDIS_URL: z
    .url()
    .refine(
      (value) => ["redis:", "rediss:"].includes(new URL(value).protocol),
      "REDIS_URL must use redis or rediss",
    ),
  RESEND_API_KEY: z.string().trim().min(1),
  AUTH_EMAIL_FROM: z.string().trim().min(3),
  SENTRY_DSN: z
    .url()
    .refine(
      (value) => ["http:", "https:"].includes(new URL(value).protocol),
      "SENTRY_DSN must use HTTP or HTTPS",
    )
    .optional(),
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

  if (parsed.RESERVATION_ACCESS_SECRET === parsed.TICKET_QR_SECRET) {
    throw new Error(
      "RESERVATION_ACCESS_SECRET must differ from TICKET_QR_SECRET",
    );
  }

  return {
    ...parsed,
    DATABASE_URL: selectMigrationDatabaseUrl(parsed),
    FRONTEND_ORIGINS: parseFrontendOrigins(parsed.FRONTEND_ORIGINS),
  };
}

export const env = parseEnv(process.env);
