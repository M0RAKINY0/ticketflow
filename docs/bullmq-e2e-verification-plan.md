# BullMQ end-to-end verification plan

## Purpose

Prove the API, PostgreSQL, Redis, BullMQ worker, Better Auth, transactional ticket outbox, and ticket email processor work together as separate running processes. This run uses local Docker infrastructure and does not add Railway or RabbitMQ configuration.

## Test data

- A fresh test user created through the email signup endpoint.
- An organizer, event, ticket type, reservation, and ticket created through public API routes where the current authorization model permits it.
- A local capture transport or a non-delivering Resend substitute for deterministic email assertions. Real recipient addresses and OTP values must not appear in logs.
- The existing `ventra_test` PostgreSQL database and an isolated Redis key prefix or a flushed test-only Redis database.

## Steps

1. Build the current branch and run the complete automated suite.
2. Start or verify PostgreSQL and Redis in Docker. Confirm PostgreSQL, Redis health, and Redis `noeviction`.
3. Apply all Prisma migrations to the test database without resetting development data.
4. Start the production build of the API and worker as separate processes with test-safe configuration.
5. Check health, OpenAPI, email signup or verification enqueueing, authentication, authorization, reservation creation, synchronous QR persistence, transactional outbox creation, BullMQ publication, ticket worker processing, and sent-marker persistence.
6. Check idempotent reservation replay and confirm it does not create duplicate reservations, tickets, inventory increments, outbox rows, or ticket jobs.
7. Stop Redis briefly where safe and confirm reservation commits remain independent of Redis and Resend. Restore Redis and confirm the outbox dispatcher recovers delivery.
8. Stop the API and worker and inspect exit status and sanitized logs.
9. Record exact commands, results, limitations, and any defects found.

## Pass conditions

- Docker services report healthy.
- All migrations are applied.
- The full automated suite, typecheck, and production build exit zero.
- API and worker start independently and shut down cleanly.
- OTP job data has no plaintext email address or OTP.
- Ticket reservation stores a ready QR and an outbox event in one committed flow.
- The ticket job contains only `ticketId`.
- The worker marks successful ticket delivery once and replay remains idempotent.
- Redis downtime does not roll back a committed reservation, and delivery resumes after Redis returns.
- Logs and Sentry-facing data contain no email, OTP, QR image, QR payload, secrets, or provider error body.

## Run record

Run on 2026-08-30 with Node.js 24.19.0.

- Docker started PostgreSQL 17 on port `55432` and Redis 7 on port `56379`; both health checks passed. Redis reported `noeviction`.
- Prisma applied all seven migrations to the fresh `ventra_e2e` database.
- `vitest run --config vitest.e2e.config.ts` passed one complete queue flow. The test verified encrypted OTP storage, email verification and sign-in, event publication, reservation while Redis was stopped, synchronous QR persistence, outbox recovery, one ticket delivery, a `{ ticketId }` BullMQ payload, and idempotent replay.
- The regular Vitest suite passed 136 tests across 22 files.
- TypeScript type checking and the production build passed. The build produced `dist/server.js` and `dist/worker.js`.
- The compiled API and worker started as separate processes against the Docker services. `/health` returned `ok` and `/api/docs/` returned Swagger UI with HTTP 200.
- The shell wrapper returned code 1 when the smoke-test processes received Ctrl+C. Unit coverage verifies the worker's signal handler exits 0 after clean application shutdown and exits 1 after cleanup failure.
