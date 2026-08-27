export const POSTGRES_URL = "postgresql://ventra:ventra@localhost:5432/ventra";
export const TEST_POSTGRES_URL =
  "postgresql://ventra:ventra@localhost:5432/ventra_test";
export const SECRET_A = "a".repeat(32);

process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.DATABASE_URL = POSTGRES_URL;
process.env.TEST_DATABASE_URL = TEST_POSTGRES_URL;
process.env.BETTER_AUTH_SECRET ??= SECRET_A;
process.env.BETTER_AUTH_URL ??= "http://localhost:4001";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.TICKET_QR_SECRET ??= "q".repeat(32);
delete process.env.SENTRY_DSN;
