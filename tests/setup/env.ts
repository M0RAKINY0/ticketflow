export const POSTGRES_URL = "postgresql://ventra:ventra@localhost:5432/ventra";
export const TEST_POSTGRES_URL =
  "postgresql://ventra:ventra@localhost:5432/ventra_test";
export const SECRET_A = "a".repeat(32);
export const SECRET_B = "b".repeat(32);

process.env.NODE_ENV = "test";
process.env.PORT = "4001";
process.env.DATABASE_URL = POSTGRES_URL;
process.env.TEST_DATABASE_URL = TEST_POSTGRES_URL;
process.env.ACCESS_TOKEN_SECRET ??= SECRET_A;
process.env.REFRESH_TOKEN_SECRET ??= SECRET_B;
