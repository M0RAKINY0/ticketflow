type DatabaseUrlInput = {
  NODE_ENV?: string | undefined;
  DATABASE_URL?: string | undefined;
  TEST_DATABASE_URL?: string | undefined;
};

export function selectMigrationDatabaseUrl(input: DatabaseUrlInput): string {
  const databaseUrl = input.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (input.NODE_ENV !== 'test') {
    return databaseUrl;
  }

  const testDatabaseUrl = input.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required when NODE_ENV is test');
  }

  if (testDatabaseUrl === databaseUrl) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL');
  }

  return testDatabaseUrl;
}
