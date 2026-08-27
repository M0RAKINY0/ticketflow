# Email verification OTP implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a five-minute Resend email OTP after password signup and store OTP plus auth rate-limit state in Redis.

**Architecture:** Better Auth's email OTP plugin owns code generation, hashing, attempts, and verification. A focused Resend service sends verification mail. The official Better Auth Redis adapter stores short-lived verification and rate-limit records, while PostgreSQL remains the session store.

**Tech Stack:** TypeScript, Express, Better Auth 1.7.2, Resend 6.24.0, `@better-auth/redis-storage` 1.7.2, ioredis 5.11.1, Redis 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-email-verification-otp-design.md`

## Global constraints

- Backend only. Do not add frontend or passwordless sign-in.
- OTPs are six digits, expire in 300 seconds, and become invalid after three failed attempts.
- Never log or report an OTP, recipient email, Redis credential, or Resend API key.
- Password sessions remain in PostgreSQL.
- Tests must not call Resend.

---

### Task 1: Configuration and local services

**Files:**

- Modify: `package.json`, `package-lock.json`, `src/config/env.ts`, `.env.example`, `tests/setup/env.ts`, `tests/unit/env.test.ts`
- Create: `compose.yml`

**Interfaces:**

- Produces `Env.REDIS_URL`, `Env.RESEND_API_KEY`, and `Env.AUTH_EMAIL_FROM`.
- Produces a localhost Redis 7 service with a health check.

- [ ] Add failing environment tests for missing or malformed values.
- [ ] Run `npm test -- tests/unit/env.test.ts` and confirm the new assertions fail.
- [ ] Install exact compatible dependencies and extend environment validation.
- [ ] Add the Redis Compose service and placeholders.
- [ ] Rerun the environment tests.

### Task 2: Resend email service

**Files:**

- Create: `src/infrastructure/email.ts`, `tests/unit/email.test.ts`

**Interfaces:**

- Produces `VerificationEmailSender.sendVerificationOtp(email: string, otp: string): Promise<void>`.
- Production construction consumes `RESEND_API_KEY` and `AUTH_EMAIL_FROM`.

- [ ] Write failing tests for the message body and sanitized provider failures.
- [ ] Run the focused test and confirm the expected failure.
- [ ] Implement the smallest injectable Resend wrapper.
- [ ] Rerun the focused test.

### Task 3: Redis storage and lifecycle

**Files:**

- Create: `src/infrastructure/redis.ts`, `tests/unit/redis.test.ts`
- Modify: `src/server.ts`, `tests/unit/http-security.test.ts`

**Interfaces:**

- Produces the shared ioredis client, Better Auth secondary storage, `connectRedis()`, and `disconnectRedis()`.
- Server startup connects before listening and shutdown closes Redis.

- [ ] Write failing lifecycle tests with an injected Redis dependency.
- [ ] Implement the official adapter with `ventra:auth:` prefix and explicit connect/disconnect functions.
- [ ] Make server startup fail before listening when Redis cannot connect.
- [ ] Rerun focused lifecycle tests.

### Task 4: Better Auth email verification

**Files:**

- Modify: `src/infrastructure/auth.ts`, `src/app.ts`, `tests/integration/auth.test.ts`

**Interfaces:**

- `createAuth` accepts injected email sender and secondary storage for deterministic tests.
- Exposes Better Auth endpoints `/email-otp/send-verification-otp` and `/email-otp/verify-email`.

- [ ] Write failing integration tests for signup without a session, blocked unverified login, successful verification, code reuse, incorrect attempts, disallowed OTP types, and resend throttling.
- [ ] Run the focused auth tests and confirm failure for missing OTP behavior.
- [ ] Configure `requireEmailVerification`, the email OTP plugin, hashed code storage, PostgreSQL session persistence, Redis rate limiting, and email/IP resend limits.
- [ ] Rerun the focused auth tests.

### Task 5: CI, documentation, and verification

**Files:**

- Modify: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**

- CI supplies Redis and placeholder email configuration.
- README documents the complete backend flow and local commands.

- [ ] Add a Redis 7 service with a health check to CI.
- [ ] Document setup, endpoints, limits, and failure behavior.
- [ ] Run Prisma generation, full tests, type checking, build, changed-file formatting, and `git diff --check`.
- [ ] Review the diff against every requirement in the design spec.
- [ ] Commit with a descriptive title and body.
