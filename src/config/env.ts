import 'dotenv/config';
import { z } from 'zod';

import { selectMigrationDatabaseUrl } from './database-url.js';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z.url(),
    TEST_DATABASE_URL: z.url().optional(),
    REDIS_URL: z.url(),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
  });

export type Env = Omit<z.infer<typeof environmentSchema>, 'DATABASE_URL'> & {
  DATABASE_URL: string;
};

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const parsed = environmentSchema.parse(input);

  return {
    ...parsed,
    DATABASE_URL: selectMigrationDatabaseUrl(parsed),
  };
}

export const env = parseEnv(process.env);
