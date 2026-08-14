import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z.url(),
    TEST_DATABASE_URL: z.url().optional(),
    REDIS_URL: z.url(),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_SECRET: z.string().min(32),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'test') {
      return;
    }

    if (!value.TEST_DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        message: 'TEST_DATABASE_URL is required when NODE_ENV is test',
        path: ['TEST_DATABASE_URL'],
      });
      return;
    }

    if (value.TEST_DATABASE_URL === value.DATABASE_URL) {
      context.addIssue({
        code: 'custom',
        message: 'TEST_DATABASE_URL must differ from DATABASE_URL',
        path: ['TEST_DATABASE_URL'],
      });
    }
  });

export type Env = Omit<z.infer<typeof environmentSchema>, 'DATABASE_URL'> & {
  DATABASE_URL: string;
};

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  const parsed = environmentSchema.parse(input);

  return {
    ...parsed,
    DATABASE_URL:
      parsed.NODE_ENV === 'test' ? parsed.TEST_DATABASE_URL! : parsed.DATABASE_URL,
  };
}

export const env = parseEnv(process.env);
