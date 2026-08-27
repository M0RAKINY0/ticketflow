# Email verification OTP design

## Purpose

Ventra will verify email ownership after email-and-password signup. A new account cannot create a session through password authentication until the user submits the six-digit code sent to that address. Google authentication remains unchanged because Google supplies its own verified identity signal.

This work adds backend support only. It does not add passwordless sign-in, password reset, Apple authentication, or frontend code.

## User flow

1. The client submits `POST /api/v1/auth/sign-up/email` with the user's name, email, and password.
2. Better Auth creates the user and credential account with `emailVerified` set to false.
3. Ventra sends a six-digit verification code through Resend.
4. The signup response does not contain an authenticated session.
5. The client submits the email and code to `POST /api/v1/auth/email-otp/verify-email`.
6. Better Auth marks the email as verified and consumes the code.
7. The user signs in through the existing password endpoint. Google sign-in continues to work without this code.

The client may request another email-verification code through `POST /api/v1/auth/email-otp/send-verification-otp`. Ventra rejects OTP types for passwordless sign-in and password reset.

## Email delivery

Ventra will use the installed `resend` package and Resend's HTTPS API. Configuration uses:

- `RESEND_API_KEY`, stored only in `.env` or the deployment secret manager.
- `AUTH_EMAIL_FROM`, containing a sender address on the verified Resend domain.

The existing `RESEND_SMTP_HOST`, `RESEND_SMTP_PORT`, `RESEND_SMTP_USER`, and `RESEND_SMTP_PASSWORD` names will be removed. The populated local API key will move from the old password variable to `RESEND_API_KEY` without printing or committing its value.

`src/infrastructure/email.ts` will own the Resend client and the verification email. The message will contain the code, its five-minute lifetime, and a warning to ignore unsolicited messages. Neither logs nor error reports may contain the API key or OTP.

The auth configuration will receive an email-sender dependency. Production uses Resend, while tests use an in-memory sender. Tests will not call Resend.

## OTP rules

Better Auth's email OTP plugin will be configured with:

- `overrideDefaultEmailVerification: true`
- `sendVerificationOnSignUp: true`
- six digits
- a five-minute expiry
- three verification attempts
- hashed OTP storage
- no automatic passwordless account creation

`emailAndPassword.requireEmailVerification` will be true. Password sign-in for an unverified account will fail without creating a session. The email callback will accept only `email-verification`; requests for `sign-in` and `forget-password` OTPs will fail without sending mail.

## Redis storage

Ventra will use `@better-auth/redis-storage` 1.7.2 with `ioredis` 5.11.1. The Redis adapter requires ioredis 5.x. `src/infrastructure/redis.ts` will own the client and expose the Better Auth secondary-storage adapter.

Redis will store short-lived verification records and Better Auth rate-limit counters under a `ventra:auth:` key prefix. Better Auth will continue storing sessions in PostgreSQL through `session.storeSessionInDatabase: true`.

The application will connect to Redis before accepting traffic and close the client during shutdown. Startup will fail if Redis is unavailable. This prevents a deployment from running without OTP verification storage or shared auth throttling.

A Docker Compose file will run Redis 7 Alpine for local development. It will bind port 6379 to localhost, persist data in a named volume, and expose a health check. `REDIS_URL` defaults only in `.env.example`; production must provide its own secret-managed URL.

## Abuse controls

The existing API-wide limit remains 100 requests per minute per IP. Better Auth's endpoint rules move from process memory to Redis so every application instance shares the same counters.

OTP delivery will allow three requests per 15 minutes per source IP. A separate atomic Redis counter will allow three requests per 15 minutes per normalized email address. The counter key will contain a keyed hash of the normalized email rather than the raw address.

Better Auth will invalidate a code after three incorrect verification attempts. A successful verification consumes the code. Responses will not reveal internal counter keys or whether an unrelated account exists.

## Failure handling

- A Resend rejection causes the email operation to fail. Ventra will record the provider error through the existing server error path without including the OTP or recipient address.
- A Redis connection failure prevents startup.
- A Redis failure after startup causes OTP and auth rate-limit operations to fail closed.
- Invalid, expired, consumed, and attempt-exhausted codes return Better Auth's safe client errors.
- Duplicate signup and invalid password behavior remain unchanged except for the new verification requirement.

## Tests

Tests will cover:

- environment parsing for `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, and `REDIS_URL`
- email message construction and Resend error handling through an injected client
- signup dispatching one verification email without returning a session
- unverified password sign-in rejection
- successful email verification followed by password sign-in
- invalid, expired, consumed, and attempt-exhausted OTPs
- rejection of passwordless and password-reset OTP types
- resend limits by IP and normalized email
- Redis TTL behavior and shared counters
- preservation of PostgreSQL session storage
- unchanged Google authorization behavior
- Redis startup and shutdown lifecycle

The full integration suite, type checking, production build, and changed-file formatting checks must pass. GitHub Actions will start PostgreSQL and Redis services before applying migrations and running tests.

## Documentation and delivery

The README will document Docker startup, the new environment variables, email verification behavior, endpoints, TTL, attempt limits, and the requirement for Redis in every environment. `.env.example` will contain placeholders only.

Implementation will happen on `email-verification-otp`. After verification, the branch will be pushed and submitted as a pull request against `main`. Merging remains a separate explicit step.
