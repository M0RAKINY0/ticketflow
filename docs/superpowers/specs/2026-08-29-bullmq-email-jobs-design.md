# BullMQ email jobs design

## Goal

Move Resend delivery out of Ventra's HTTP request path without moving ticket inventory or QR generation out of PostgreSQL transactions. BullMQ will process two kinds of work: authentication OTP delivery and ticket-confirmation delivery.

This change does not add Railway configuration, split Ventra into services, or move QR generation into a worker.

## Current behavior

Ventra generates the ticket public ID and QR PNG before it opens the reservation transaction. The transaction reserves capacity and stores a `READY` ticket with the QR data URL. After the transaction commits, the API sends the ticket email through Resend and records `Ticket.emailSentAt`. A Resend failure currently turns the reservation response into a server error even though the reservation remains committed.

Better Auth generates a six-digit verification code, stores its hashed verification record in Redis, and calls Resend synchronously. The code expires after five minutes.

## Architecture

Ventra remains one modular monolith with two runtime entry points from the same repository:

- The API handles HTTP requests, commits business data, and writes ticket-email outbox records.
- The worker publishes pending outbox records to BullMQ and consumes the OTP and ticket-email queues.

Both runtimes share PostgreSQL, Redis, Resend, Sentry, configuration validation, Prisma types, and email rendering code.

```text
OTP request -> API -> OTP queue -> email worker -> Resend

Reservation request
  -> PostgreSQL transaction
       -> reservation + READY ticket + outbox event
  -> API response

Outbox dispatcher -> ticket-email queue -> email worker -> PostgreSQL + Resend
```

Redis remains the BullMQ backend. The existing Compose Redis command will set `maxmemory-policy noeviction`, which BullMQ requires to prevent queue keys from being evicted. Development runs Redis through Compose and starts the API and worker as separate host processes. Containerizing the Node runtimes and configuring Railway remain separate deployment work.

## Queue boundaries

Use two queues so delayed ticket delivery cannot block time-sensitive OTP delivery:

- `ventra-auth-email` accepts only `send-verification-otp` jobs.
- `ventra-ticket-email` accepts only `send-ticket-confirmation` jobs.

Job names and payloads are discriminated TypeScript types. Processors reject unknown names and malformed payloads with Zod before any side effect.

Queue keys use BullMQ's `prefix` option under the existing `ventra` Redis namespace. The shared ioredis client must not use `keyPrefix` because BullMQ does not support that option. API producer connections fail quickly when Redis is unavailable. Worker connections use `maxRetriesPerRequest: null` so they continue reconnecting.

## Ticket-email publishing

### Transactional outbox

Add an `OutboxEvent` model with:

- UUID `id`
- `type`, initially `TICKET_EMAIL_REQUESTED`
- UUID `aggregateId`, containing the ticket ID
- `createdAt`
- nullable `publishedAt`
- nullable `lockedAt` and `lockedBy`
- `attempts`
- `nextAttemptAt`
- nullable `lastError`

`type` and `aggregateId` are unique together. The reservation transaction inserts the outbox event beside the ticket. An idempotent reservation replay checks for the event and creates it only if delivery is still pending and the event is missing.

The worker's outbox dispatcher claims small batches with a PostgreSQL lease. It publishes each event outside the claim transaction, then marks it published. An expired lease can be reclaimed after 60 seconds. Failed publication increments `attempts`, records a sanitized error, and sets exponential `nextAttemptAt` delays capped at five minutes.

The BullMQ job ID is `ticket-email-<ticket-id>`. A crash after queue insertion but before `publishedAt` is written may cause another publish attempt. BullMQ suppresses it while the retained job ID exists. The worker also checks `Ticket.emailSentAt`, and Resend keeps `ticket-confirmation/<ticket-id>` as its idempotency key. These checks make repeated processing safe.

### Ticket worker

The job payload contains only `ticketId`. The worker loads the attendee, event, ticket type, and stored QR data from PostgreSQL. It skips a ticket with `emailSentAt`, calls the existing ticket email sender, and records `emailSentAt` after Resend accepts the request.

Ticket jobs use five attempts with exponential backoff starting at five seconds. Completed jobs remain for 24 hours with a count ceiling of 1,000. Failed jobs remain for seven days with a count ceiling of 5,000. Final failures go to Sentry with the job ID, job name, ticket ID, attempt count, and sanitized error. No email address, QR payload, or QR image enters Sentry context.

The reservation endpoint returns as soon as PostgreSQL commits. A Redis or Resend outage does not reverse a valid reservation and does not turn its response into an error.

## OTP delivery

Better Auth's `sendVerificationOTP` callback keeps the existing rate-limit check, encrypts a minimal delivery envelope, and adds it to `ventra-auth-email`. The API waits only for Redis to accept the job.

The plaintext email address and OTP must not remain in BullMQ job data. Derive an AES-256-GCM key from `BETTER_AUTH_SECRET` with HKDF and a fixed `ventra-otp-job-v1` context. Each job uses a random nonce and stores only ciphertext, authentication tag, nonce, and `expiresAt`. The short lifetime means a Better Auth secret rotation may invalidate queued OTPs, which is acceptable because users can request a new code.

OTP jobs use random UUID-based job IDs, three attempts, fixed one-second backoff, and a deadline four minutes after enqueueing. The worker checks `expiresAt` before each attempt and treats an expired message as unrecoverable. Completed and failed OTP jobs are removed after the worker emits its sanitized Sentry event. OTP values and decrypted recipient addresses never enter logs, return values, job progress, failure messages, or Sentry metadata.

The HTTP response means Redis accepted the email job, not that Resend delivered it. Existing OTP expiry, allowed attempts, and per-IP and per-email request limits do not change.

## Runtime lifecycle

Add `src/worker.ts` as the production entry point and worker scripts alongside the existing API scripts. Startup validates the same environment, connects to PostgreSQL and Redis, starts both queue consumers, and starts the outbox dispatcher.

On `SIGTERM` or `SIGINT`, the worker stops claiming outbox records, closes both BullMQ workers so active jobs finish, closes queue producers and Redis connections, flushes Sentry, disconnects Prisma, and exits. Shutdown has an application timeout; if work does not finish, BullMQ's stalled-job mechanism allows another worker to recover it.

The worker exits during startup when PostgreSQL or Redis is unavailable. After startup, Redis reconnects without terminating the process. Unexpected worker-level errors are reported to Sentry and set a failing process exit code when continued operation is unsafe.

## Application structure

- `src/infrastructure/queues/` owns BullMQ connections, queue names, job schemas, producers, and worker factories.
- `src/infrastructure/outbox/` owns leasing, publication, retry scheduling, and repository operations.
- `src/modules/notifications/` owns OTP encryption and email job processors.
- The existing `src/infrastructure/email.ts` remains the Resend boundary and keeps rendering messages.
- Ticketing creates the outbox record inside its existing reservation transaction but does not import BullMQ.
- Better Auth calls an injected OTP job producer rather than Resend directly.

This keeps business transactions independent of Redis while limiting queue-specific code to infrastructure and notification modules.

## Database migration

Add `OutboxEvent` and its enum through a forward-only Prisma migration. Index pending work by `publishedAt`, `nextAttemptAt`, and `lockedAt`. Do not reset either database and do not modify existing ticket or authentication records.

## Failure behavior

- PostgreSQL reservation failure creates neither a ticket nor an outbox event.
- Redis failure leaves the outbox event pending for a later dispatch attempt.
- Resend ticket-email failure retries in BullMQ and leaves the reservation valid.
- Duplicate ticket jobs short-circuit through `emailSentAt` and the Resend idempotency key.
- Redis failure while accepting an OTP job makes the OTP request fail, so the client can retry.
- Expired or undecryptable OTP jobs never call Resend.
- Permanent job failure produces sanitized Sentry context and retained ticket-job diagnostics.

## Testing

Unit tests cover job-schema validation, OTP encryption and expiry, queue options, outbox retry calculations, email processor idempotency, and sanitized failure reporting.

Integration tests cover:

- reservation, ticket, and outbox creation in one transaction
- immediate reservation success while Resend is unavailable
- outbox recovery after Redis publication failure
- safe duplicate publication and processing
- ticket-email retry and `emailSentAt` updates
- OTP enqueueing, priority isolation, delivery, expiry, and removal
- worker startup and graceful shutdown boundaries
- unchanged ticket retrieval, QR retrieval, check-in, auth rate limits, and error envelopes

The final verification runs Prisma generation and migrations, the full test suite, type checking, production builds for both entry points, and changed-file formatting checks.

## Documentation

Update `README.md`, `.env.example` only if configuration changes, Compose instructions, worker commands, data-flow notes, and failure semantics. OpenAPI does not change because no public route is added or removed.
