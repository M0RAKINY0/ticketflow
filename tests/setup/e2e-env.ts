process.env.NODE_ENV = "test";
process.env.PORT = "4400";
process.env.HOST = "127.0.0.1";
process.env.FRONTEND_ORIGINS = "http://localhost:5173";
process.env.DATABASE_URL = "postgresql://ventra:ventra@127.0.0.1:5432/ventra";
process.env.TEST_DATABASE_URL =
  "postgresql://ventra:ventra@127.0.0.1:55432/ventra_e2e";
process.env.BETTER_AUTH_SECRET = "e".repeat(32);
process.env.BETTER_AUTH_URL = "http://127.0.0.1:4400";
process.env.GOOGLE_CLIENT_ID = "e2e-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "e2e-google-client-secret";
process.env.TICKET_QR_SECRET = "q".repeat(32);
process.env.REDIS_URL = "redis://127.0.0.1:56379";
process.env.RESEND_API_KEY = "re_e2e_not_used";
process.env.AUTH_EMAIL_FROM = "Ventra E2E <e2e@example.com>";
delete process.env.SENTRY_DSN;
