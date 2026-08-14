import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/config/env.js';
import { POSTGRES_URL, SECRET_A, SECRET_B } from '../setup/env.js';

describe('parseEnv', () => {
  it('rejects an integration database equal to the application database', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'test',
        PORT: '4000',
        DATABASE_URL: POSTGRES_URL,
        TEST_DATABASE_URL: POSTGRES_URL,
        REDIS_URL: 'redis://localhost:6379',
        ACCESS_TOKEN_SECRET: SECRET_A,
        REFRESH_TOKEN_SECRET: SECRET_B,
      }),
    ).toThrow(/TEST_DATABASE_URL must differ/);
  });
});
