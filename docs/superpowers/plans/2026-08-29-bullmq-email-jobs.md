# BullMQ Email Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OTP and ticket-confirmation delivery into durable BullMQ workers while preserving synchronous QR generation and reliable reservation commits.

**Architecture:** The API adds encrypted OTP jobs directly to an auth-email queue and writes ticket-email requests to a PostgreSQL transactional outbox. A separate worker runtime dispatches outbox rows to BullMQ and consumes both queues through the existing Resend senders. Ticket jobs are idempotent through the outbox uniqueness constraint, BullMQ job IDs, `Ticket.emailSentAt`, and Resend idempotency keys.

**Tech Stack:** Node.js 24, TypeScript 6, Express 5, BullMQ 6.3.1, ioredis 5, PostgreSQL, Prisma 7, Zod 4, Resend 6, Sentry 10, Vitest 4, Docker Compose Redis 7

**Spec:** `docs/superpowers/specs/2026-08-29-bullmq-email-jobs-design.md`

## Global constraints

- Keep Ventra as one modular monolith with separate API and worker runtime entry points from the same repository.
- Keep ticket inventory, reservation creation, ticket creation, and QR generation synchronous.
- Do not add Railway configuration or containerize the Node runtimes.
- Use the existing Redis, PostgreSQL, Resend, Sentry, `BETTER_AUTH_SECRET`, and `REDIS_URL` configuration.
- Never place a plaintext OTP, recipient email, QR payload, or QR image in logs or Sentry metadata.
- Do not preserve the synchronous ticket-email behavior or old auth email-sender injection compatibility.
- Write every production behavior test-first and watch the focused test fail for the intended reason.
- Update `README.md` before the final implementation commit.

---

## File map

### New files

- `src/infrastructure/queues/contracts.ts`: queue names, Zod job schemas, and exported job types.
- `src/infrastructure/queues/connections.ts`: producer and worker ioredis connection factories.
- `src/infrastructure/queues/email-queues.ts`: BullMQ queue factories and job option constants.
- `src/modules/notifications/otp-envelope.ts`: AES-256-GCM OTP job encryption and decryption.
- `src/modules/notifications/otp.producer.ts`: Better Auth-facing OTP queue producer.
- `src/modules/notifications/otp.processor.ts`: OTP worker processor.
- `src/modules/notifications/ticket-email.repository.ts`: ticket delivery reads and sent-marker update.
- `src/modules/notifications/ticket-email.processor.ts`: idempotent ticket email processor.
- `src/infrastructure/outbox/outbox.repository.ts`: PostgreSQL leasing and outbox state updates.
- `src/infrastructure/outbox/outbox.dispatcher.ts`: ticket outbox-to-BullMQ publication loop.
- `src/infrastructure/queues/email-workers.ts`: BullMQ worker construction and sanitized failure hooks.
- `src/worker.ts`: worker process startup and shutdown.
- `tests/unit/queue-contracts.test.ts`: schema and queue-option contracts.
- `tests/unit/otp-envelope.test.ts`: encryption, tamper detection, and expiry.
- `tests/unit/otp-processor.test.ts`: OTP delivery and expiry behavior.
- `tests/unit/ticket-email-processor.test.ts`: ticket delivery idempotency.
- `tests/unit/outbox-dispatcher.test.ts`: publication, duplicate, retry, and lease behavior.
- `tests/unit/worker-lifecycle.test.ts`: startup and graceful shutdown ordering.
- `prisma/migrations/20260829230000_add_email_outbox/migration.sql`: outbox enum, table, constraint, and indexes.

### Modified files

- `package.json` and `package-lock.json`: BullMQ dependency and worker scripts.
- `compose.yml`: Redis `noeviction` policy.
- `prisma/schema.prisma`: `OutboxEventType` and `OutboxEvent`.
- `src/infrastructure/auth.ts`: enqueue OTP delivery instead of calling Resend.
- `src/infrastructure/redis.ts`: keep auth Redis separate from BullMQ connection settings.
- `src/infrastructure/sentry.ts`: sanitized background-job reporting.
- `src/modules/ticketing/ticketing.service.ts`: create ticket outbox rows transactionally and remove synchronous email delivery.
- `src/modules/ticketing/ticketing.model.ts`: remove ticket-email delivery methods after moving them to notifications.
- `tests/integration/auth.test.ts`: assert OTP enqueue behavior.
- `tests/integration/ticketing.test.ts`: assert outbox and immediate reservation behavior.
- `tests/setup/env.ts`: keep deterministic queue test configuration.
- `README.md`: worker commands, queue behavior, outbox recovery, Redis policy, and failure semantics.

---

### Task 1: Queue contracts, connections, and options

**Files:**

- Create: `src/infrastructure/queues/contracts.ts`
- Create: `src/infrastructure/queues/connections.ts`
- Create: `src/infrastructure/queues/email-queues.ts`
- Create: `tests/unit/queue-contracts.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `compose.yml`

**Interfaces:**

- Produces: `AUTH_EMAIL_QUEUE`, `TICKET_EMAIL_QUEUE`, `OtpDeliveryJob`, `TicketEmailJob`, `parseOtpDeliveryJob`, `parseTicketEmailJob`.
- Produces: `createQueueProducerConnection(url: string): Redis` and `createQueueWorkerConnection(url: string): Redis`.
- Produces: `createEmailQueues(connection)` returning `{ authEmailQueue, ticketEmailQueue, close() }`.
- Produces: `OTP_JOB_OPTIONS` and `TICKET_JOB_OPTIONS` as BullMQ `JobsOptions`.

- [ ] **Step 1: Install BullMQ 6.3.1**

Run:

```bash
npm install bullmq@6.3.1
```

Expected: `bullmq` appears in `dependencies` and the lockfile resolves version `6.3.1`.

- [ ] **Step 2: Write the failing queue contract tests**

Create `tests/unit/queue-contracts.test.ts` with assertions that:

```ts
expect(parseTicketEmailJob({ ticketId: ticketUuid })).toEqual({
  ticketId: ticketUuid,
});
expect(() => parseTicketEmailJob({ ticketId: "not-a-uuid" })).toThrow();
expect(() =>
  parseOtpDeliveryJob({
    version: 1,
    ciphertext: "",
    iv: "",
    tag: "",
    expiresAt: "invalid",
  }),
).toThrow();
expect(OTP_JOB_OPTIONS).toMatchObject({
  attempts: 3,
  backoff: { type: "fixed", delay: 1_000 },
  removeOnComplete: true,
  removeOnFail: true,
});
expect(TICKET_JOB_OPTIONS).toMatchObject({
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800, count: 5_000 },
});
```

- [ ] **Step 3: Run the tests and verify the missing-module failure**

Run:

```bash
npx vitest run tests/unit/queue-contracts.test.ts
```

Expected: FAIL because the queue contract modules do not exist.

- [ ] **Step 4: Implement the contracts and queue factories**

Use these exact queue names and payload shapes in `contracts.ts`:

```ts
export const AUTH_EMAIL_QUEUE = "ventra-auth-email";
export const TICKET_EMAIL_QUEUE = "ventra-ticket-email";

const ticketEmailJobSchema = z.object({ ticketId: z.uuid() }).strict();
const otpDeliveryJobSchema = z
  .object({
    version: z.literal(1),
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
    tag: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
```

Export parser functions that call `.parse`. In `connections.ts`, create fresh ioredis instances without `keyPrefix`:

```ts
export function createQueueProducerConnection(url: string): Redis {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

export function createQueueWorkerConnection(url: string): Redis {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
}
```

In `email-queues.ts`, pass `prefix: "ventra:queue"` to both `Queue` instances and expose a `close` method that closes both queues before quitting the producer connection.

- [ ] **Step 5: Configure Redis against eviction**

Change the Compose command to:

```yaml
command: redis-server --appendonly yes --maxmemory-policy noeviction
```

- [ ] **Step 6: Run focused tests and type checking**

Run:

```bash
npx vitest run tests/unit/queue-contracts.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit the queue foundation**

```bash
git add package.json package-lock.json compose.yml src/infrastructure/queues tests/unit/queue-contracts.test.ts
git commit -m "Add BullMQ email queue foundation" -m "Define validated email job contracts, separate producer and worker Redis connections, durable queue options, and the Redis noeviction policy."
```

---

### Task 2: Encrypted OTP email jobs

**Files:**

- Create: `src/modules/notifications/otp-envelope.ts`
- Create: `src/modules/notifications/otp.producer.ts`
- Create: `src/modules/notifications/otp.processor.ts`
- Create: `tests/unit/otp-envelope.test.ts`
- Create: `tests/unit/otp-processor.test.ts`
- Modify: `src/infrastructure/auth.ts`
- Modify: `tests/integration/auth.test.ts`

**Interfaces:**

- Consumes: `OtpDeliveryJob`, `AUTH_EMAIL_QUEUE`, `OTP_JOB_OPTIONS` from Task 1.
- Produces: `encryptOtpDelivery(input, secret, now): OtpDeliveryJob` and `decryptOtpDelivery(job, secret, now): { email: string; otp: string }`.
- Produces: `VerificationOtpProducer` with `enqueue(email: string, otp: string): Promise<void>`.
- Produces: `createOtpProducer(queue, secret, clock?, idFactory?): VerificationOtpProducer`.
- Produces: `createOtpProcessor({ secret, sender, clock? }): (job: Job) => Promise<void>`.

- [ ] **Step 1: Write failing encryption tests**

Test round-trip encryption, random nonces, ciphertext that excludes both email and OTP, authentication failure after changing one ciphertext byte, and expiry at exactly `expiresAt`. Use literal inputs and a fixed clock:

```ts
const encrypted = encryptOtpDelivery(
  { email: "person@example.com", otp: "123456" },
  "a".repeat(32),
  new Date("2030-01-01T00:00:00.000Z"),
);
expect(JSON.stringify(encrypted)).not.toContain("person@example.com");
expect(JSON.stringify(encrypted)).not.toContain("123456");
expect(
  decryptOtpDelivery(
    encrypted,
    "a".repeat(32),
    new Date("2030-01-01T00:03:59.999Z"),
  ),
).toEqual({ email: "person@example.com", otp: "123456" });
```

- [ ] **Step 2: Verify the encryption tests fail**

Run:

```bash
npx vitest run tests/unit/otp-envelope.test.ts
```

Expected: FAIL because `otp-envelope.ts` does not exist.

- [ ] **Step 3: Implement the encrypted envelope**

Derive a 32-byte key with `hkdfSync("sha256", secret, "", "ventra-otp-job-v1", 32)`. Encrypt JSON with `aes-256-gcm`, a random 12-byte IV, and Base64URL fields. Set `expiresAt` to four minutes after `now`. Throw `UnrecoverableError("OTP job expired")` for expiry and `UnrecoverableError("OTP job cannot be decrypted")` for authentication failure. Never include the envelope, email, or OTP in either message.

- [ ] **Step 4: Write failing producer and processor tests**

Use a fake queue that records `add` calls and the real encryption functions. Assert:

```ts
expect(addCall).toMatchObject({
  name: "send-verification-otp",
  options: {
    jobId: expect.stringMatching(/^otp-[0-9a-f-]{36}$/),
    attempts: 3,
  },
});
expect(JSON.stringify(addCall.data)).not.toContain("123456");
```

For the processor, use a fake `VerificationEmailSender`. Assert that a valid job sends once, an expired job never sends, and a malformed job never sends.

- [ ] **Step 5: Verify producer and processor tests fail**

Run:

```bash
npx vitest run tests/unit/otp-processor.test.ts
```

Expected: FAIL because producer and processor modules do not exist.

- [ ] **Step 6: Implement producer and processor**

`createOtpProducer` encrypts the payload and calls:

```ts
await queue.add("send-verification-otp", payload, {
  ...OTP_JOB_OPTIONS,
  jobId: `otp-${idFactory()}`,
});
```

The processor must parse the job data before decryption, require `job.name === "send-verification-otp"`, decrypt, and call the existing `VerificationEmailSender.sendVerificationOtp`.

- [ ] **Step 7: Replace Better Auth's direct sender dependency**

Change `createAuth` options from `emailSender?: VerificationEmailSender` to `otpProducer?: VerificationOtpProducer`. Preserve the test-mode no-op default. The callback becomes:

```ts
await emailLimiter(email);
await otpProducer.enqueue(email, otp);
```

Update auth integration tests to inject a producer that records calls. Assert the HTTP route queues the expected recipient without asserting or logging the OTP value.

- [ ] **Step 8: Run OTP and auth tests**

Run:

```bash
npx vitest run tests/unit/otp-envelope.test.ts tests/unit/otp-processor.test.ts tests/integration/auth.test.ts --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit encrypted OTP jobs**

```bash
git add src/infrastructure/auth.ts src/modules/notifications tests/unit/otp-envelope.test.ts tests/unit/otp-processor.test.ts tests/integration/auth.test.ts
git commit -m "Queue encrypted OTP email jobs" -m "Encrypt short-lived OTP delivery payloads, enqueue them through BullMQ, validate worker input, and preserve Better Auth rate limits."
```

---

### Task 3: Transactional ticket-email outbox

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260829230000_add_email_outbox/migration.sql`
- Modify: `src/modules/ticketing/ticketing.service.ts`
- Modify: `src/modules/ticketing/ticketing.model.ts`
- Modify: `tests/integration/ticketing.test.ts`

**Interfaces:**

- Produces: Prisma `OutboxEventType.TICKET_EMAIL_REQUESTED` and `OutboxEvent`.
- Produces: `ticketingModel.ensureTicketEmailOutbox(ticketId: string): Promise<void>` for replay repair.
- Removes: synchronous `ticketEmailSender` calls from reservation creation and replay.

- [ ] **Step 1: Write the failing reservation outbox tests**

Change reservation integration tests to assert that:

- the first reservation returns `201` without invoking the Resend sender
- the committed ticket remains `READY` with its QR data URL
- exactly one outbox row exists with `type: "TICKET_EMAIL_REQUESTED"`, `aggregateId: ticketId`, and `publishedAt: null`
- a sequential replay and two concurrent same-key requests still leave one reservation, one ticket, one inventory increment, and one outbox row
- removing the outbox row for an unsent ticket and replaying the reservation recreates one row

- [ ] **Step 2: Run the reservation tests and verify failure**

Run:

```bash
npx vitest run tests/integration/ticketing.test.ts -t "outbox|reservation" --maxWorkers=1
```

Expected: FAIL because `OutboxEvent` does not exist and the API still sends email synchronously.

- [ ] **Step 3: Add the Prisma outbox model**

Add:

```prisma
enum OutboxEventType {
  TICKET_EMAIL_REQUESTED
}

model OutboxEvent {
  id            String          @id @default(uuid()) @db.Uuid
  type          OutboxEventType
  aggregateId   String          @db.Uuid
  createdAt     DateTime        @default(now()) @db.Timestamptz(3)
  publishedAt   DateTime?       @db.Timestamptz(3)
  lockedAt      DateTime?       @db.Timestamptz(3)
  lockedBy      String?
  attempts      Int             @default(0)
  nextAttemptAt DateTime        @default(now()) @db.Timestamptz(3)
  lastError     String?

  @@unique([type, aggregateId])
  @@index([publishedAt, nextAttemptAt, lockedAt])
}
```

Generate a forward-only migration. Apply it to development and test databases without resetting either database, then regenerate Prisma.

- [ ] **Step 4: Write the outbox row inside the reservation transaction**

Generate `ticketId` before the transaction. Pass it into the nested ticket create and add this write before the transaction returns:

```ts
await transaction.outboxEvent.create({
  data: {
    type: "TICKET_EMAIL_REQUESTED",
    aggregateId: ticketId,
  },
});
```

Delete synchronous email delivery from both new and replay paths. Implement replay repair with a Prisma `upsert` keyed by `type_aggregateId`, but skip it when `Ticket.emailSentAt` is non-null.

- [ ] **Step 5: Run reservation tests and Prisma checks**

Run:

```bash
npm run prisma:generate
npx vitest run tests/integration/ticketing.test.ts --maxWorkers=1
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the transactional outbox**

```bash
git add prisma src/modules/ticketing tests/integration/ticketing.test.ts
git commit -m "Create ticket email outbox transactionally" -m "Commit one ticket-email event with each reservation, repair missing events on replay, and remove Resend from the reservation request path."
```

---

### Task 4: Idempotent ticket-email processor

**Files:**

- Create: `src/modules/notifications/ticket-email.repository.ts`
- Create: `src/modules/notifications/ticket-email.processor.ts`
- Create: `tests/unit/ticket-email-processor.test.ts`
- Modify: `src/modules/ticketing/ticketing.model.ts`

**Interfaces:**

- Consumes: `TicketEmailJob` and existing `TicketEmailSender`.
- Produces: `TicketEmailRepository` with `findDelivery(ticketId)` and `markSent(ticketId, sentAt)`.
- Produces: `createTicketEmailProcessor({ repository, sender, clock? }): (job: Job) => Promise<void>`.

- [ ] **Step 1: Write failing processor tests**

Use a fake repository with a complete delivery fixture and the real `createTicketEmailSender` backed by a fake transport. Assert:

- a `READY` unsent ticket produces the existing email payload and marks the same ticket sent
- a ticket with `emailSentAt` returns without calling the sender
- a missing ticket throws `UnrecoverableError("Ticket email target does not exist")`
- a ticket without a QR throws `UnrecoverableError("Ticket QR code is not ready")`
- an unknown job name or invalid UUID fails before any repository write
- a Resend error throws an ordinary `Error`, allowing BullMQ retries

- [ ] **Step 2: Verify the processor tests fail**

Run:

```bash
npx vitest run tests/unit/ticket-email-processor.test.ts
```

Expected: FAIL because the processor and repository do not exist.

- [ ] **Step 3: Implement the repository projection**

Move the ticket-email projection and `emailSentAt` update from `ticketing.model.ts` into `ticket-email.repository.ts`. The projection must select only ticket ID, public ID, QR data URL, `emailSentAt`, attendee email and name, event title/start/timezone, and ticket type name.

- [ ] **Step 4: Implement the processor**

Parse `{ ticketId }`, load the projection, short-circuit sent tickets, send with the existing `TicketEmailSender`, and call `markSent(ticketId, clock())`. Do not pass BullMQ job metadata into Resend or the database.

- [ ] **Step 5: Run processor and email tests**

Run:

```bash
npx vitest run tests/unit/ticket-email-processor.test.ts tests/unit/email.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the ticket processor**

```bash
git add src/modules/notifications src/modules/ticketing/ticketing.model.ts tests/unit/ticket-email-processor.test.ts
git commit -m "Process ticket emails idempotently" -m "Load ticket delivery data in the worker, skip completed sends, reject permanent data errors, and retain Resend failures for BullMQ retry."
```

---

### Task 5: Leased outbox dispatcher

**Files:**

- Create: `src/infrastructure/outbox/outbox.repository.ts`
- Create: `src/infrastructure/outbox/outbox.dispatcher.ts`
- Create: `tests/unit/outbox-dispatcher.test.ts`

**Interfaces:**

- Consumes: `TICKET_EMAIL_QUEUE`, `TICKET_JOB_OPTIONS`, `TicketEmailJob`.
- Produces: `OutboxRepository.claimBatch(input)`, `markPublished(id, publishedAt)`, and `markFailed(input)`.
- Produces: `calculateOutboxRetry(attempts: number): number` returning milliseconds capped at `300_000`.
- Produces: `createOutboxDispatcher({ repository, queue, workerId, clock? })` with `dispatchOnce(limit?: number)` and `run(signal, intervalMs?)`.

- [ ] **Step 1: Write failing dispatcher tests**

Use fake repository and queue implementations. Assert:

```ts
expect(calculateOutboxRetry(1)).toBe(2_000);
expect(calculateOutboxRetry(8)).toBe(256_000);
expect(calculateOutboxRetry(9)).toBe(300_000);
```

Assert that `dispatchOnce` publishes `send-ticket-confirmation` with `{ ticketId: aggregateId }`, `jobId: ticket-email-<aggregateId>`, and `TICKET_JOB_OPTIONS`, then marks the event published. A queue rejection must call `markFailed` with `lastError: "Queue publication failed"` and must not include the thrown provider text.

- [ ] **Step 2: Verify dispatcher tests fail**

Run:

```bash
npx vitest run tests/unit/outbox-dispatcher.test.ts
```

Expected: FAIL because the dispatcher does not exist.

- [ ] **Step 3: Implement PostgreSQL leasing**

`claimBatch` runs one short Prisma transaction. Use `SELECT ... FOR UPDATE SKIP LOCKED` to select unpublished rows where `nextAttemptAt <= now` and `lockedAt IS NULL OR lockedAt < leaseExpiredAt`. Update the selected rows with `lockedAt = now` and `lockedBy = workerId`, then return them. Never call Redis inside this transaction.

`markPublished` sets `publishedAt`, clears the lease and `lastError`. `markFailed` increments `attempts`, sets `nextAttemptAt`, stores the sanitized constant, and clears the lease.

- [ ] **Step 4: Implement the dispatcher loop**

`dispatchOnce` handles each claimed event independently so one failed publish does not block the rest. `run` repeatedly calls it until `AbortSignal.aborted`, using an injectable interval wait so tests do not sleep.

- [ ] **Step 5: Run dispatcher tests and type checking**

Run:

```bash
npx vitest run tests/unit/outbox-dispatcher.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the dispatcher**

```bash
git add src/infrastructure/outbox tests/unit/outbox-dispatcher.test.ts
git commit -m "Dispatch ticket email outbox events" -m "Lease pending PostgreSQL events, publish stable BullMQ jobs, and schedule sanitized retries without holding database transactions across Redis calls."
```

---

### Task 6: Worker runtime, lifecycle, and Sentry

**Files:**

- Create: `src/infrastructure/queues/email-workers.ts`
- Create: `src/worker.ts`
- Create: `tests/unit/worker-lifecycle.test.ts`
- Modify: `src/infrastructure/sentry.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: OTP and ticket processor factories, queue contracts, worker connection, and outbox dispatcher.
- Produces: `reportBackgroundJobFailure(input): void` with sanitized tags and context.
- Produces: `startWorkerRuntime(dependencies?): Promise<{ close(): Promise<void> }>`.

- [ ] **Step 1: Write failing Sentry sanitization tests**

Extend Sentry unit tests with an injected capture function. Assert that the captured event includes queue name, job name, job ID, attempt count, and ticket ID only. Assert that JSON serialization excludes `email`, `otp`, `qrPayload`, `qrCodeDataUrl`, and the original job data object.

- [ ] **Step 2: Verify Sentry tests fail**

Run:

```bash
npx vitest run tests/unit/sentry.test.ts
```

Expected: FAIL because `reportBackgroundJobFailure` does not exist.

- [ ] **Step 3: Implement background failure reporting**

Create a new sanitized `Error("Background email job failed")`, attach queue/job tags and allowed scalar context, and pass it to Sentry only when initialized. Do not attach the processor error as `cause` because provider errors may contain recipient data.

- [ ] **Step 4: Write failing lifecycle tests**

Create fake resources that record calls. Assert startup order:

```text
connect producer Redis
connect worker Redis
verify PostgreSQL
start queue workers
start outbox dispatcher
```

Assert close order:

```text
abort dispatcher
close auth worker
close ticket worker
close queues
quit worker Redis
flush Sentry
disconnect Prisma
```

Assert repeated `close()` calls are harmless.

- [ ] **Step 5: Verify lifecycle tests fail**

Run:

```bash
npx vitest run tests/unit/worker-lifecycle.test.ts
```

Expected: FAIL because `src/worker.ts` does not exist.

- [ ] **Step 6: Build BullMQ workers and runtime**

Create one BullMQ `Worker` per queue with `prefix: "ventra:queue"`. Validate every job inside its processor. Register `failed` handlers that call `reportBackgroundJobFailure` only after `attemptsMade >= opts.attempts` or for `UnrecoverableError`.

`startWorkerRuntime` must verify PostgreSQL with `prisma.$queryRaw\`SELECT 1\``, connect both Redis roles, start workers, and launch the outbox loop. Register `SIGINT`and`SIGTERM`only in the executable entry-point block. Use a 30-second application shutdown timeout around BullMQ`worker.close()` calls.

- [ ] **Step 7: Add worker scripts**

Add:

```json
"worker:dev": "node --import tsx --import ./src/instrument.ts --watch src/worker.ts",
"worker:start": "node --import ./dist/instrument.js dist/worker.js"
```

- [ ] **Step 8: Run worker and integration tests**

Run:

```bash
npx vitest run tests/unit/worker-lifecycle.test.ts tests/unit/sentry.test.ts tests/unit/otp-processor.test.ts tests/unit/ticket-email-processor.test.ts tests/unit/outbox-dispatcher.test.ts
npx vitest run tests/integration/auth.test.ts tests/integration/ticketing.test.ts --maxWorkers=1
npm run typecheck
npm run build
```

Expected: PASS and `dist/worker.js` exists.

- [ ] **Step 9: Commit the worker runtime**

```bash
git add src/infrastructure/queues src/infrastructure/sentry.ts src/worker.ts package.json package-lock.json tests/unit/worker-lifecycle.test.ts tests/unit/sentry.test.ts
git commit -m "Run BullMQ email workers" -m "Start isolated OTP and ticket consumers, dispatch the transactional outbox, report sanitized final failures, and shut down workers gracefully."
```

---

### Task 7: Documentation and final verification

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-29-bullmq-email-jobs.md`
- Modify: `.env.example` only if implementation adds a configuration value despite the approved design.

**Interfaces:**

- Consumes: all runtime commands, queue names, retention rules, and failure behavior from Tasks 1 through 6.
- Produces: operator instructions matching the final code.

- [ ] **Step 1: Update README architecture and commands**

Document:

- `docker compose up -d redis`
- `npm run dev` for the API
- `npm run worker:dev` for the worker
- synchronous QR creation and asynchronous ticket delivery
- transactional outbox recovery
- encrypted, four-minute OTP queue envelopes
- Redis `noeviction` requirement
- ticket retry and retention values
- Sentry's sanitized final-failure reporting
- the absence of Railway configuration in this change

- [ ] **Step 2: Apply migrations to both local databases**

Run the existing migration command once with the development URL and once with `NODE_ENV=test` and `TEST_DATABASE_URL`. Do not reset either database. Confirm `prisma migrate status` reports every migration applied.

- [ ] **Step 3: Run the complete verification suite**

Run:

```bash
npm run prisma:generate
npm test -- --run --maxWorkers=1
npm run typecheck
npm run build
npx prettier --check README.md docs/superpowers/specs/2026-08-29-bullmq-email-jobs-design.md docs/superpowers/plans/2026-08-29-bullmq-email-jobs.md src/infrastructure/queues src/infrastructure/outbox src/modules/notifications src/infrastructure/auth.ts src/infrastructure/sentry.ts src/modules/ticketing/ticketing.service.ts src/modules/ticketing/ticketing.model.ts src/worker.ts tests
git diff --check
```

Expected: all tests pass, type checking exits zero, build exits zero, changed files pass formatting, and the diff has no whitespace errors.

- [ ] **Step 4: Review the final diff against the spec**

Confirm each of these with code or a test:

- QR generation is still synchronous.
- Reservation success no longer depends on Redis or Resend.
- Ticket outbox insertion shares the reservation transaction.
- Ticket jobs contain only a ticket ID.
- OTP queue payloads contain no plaintext email or code.
- Expired OTP jobs cannot call Resend.
- Worker shutdown closes BullMQ before Redis and Prisma.
- No Railway or RabbitMQ files exist in the diff.

- [ ] **Step 5: Commit documentation and verification updates**

```bash
git add README.md docs/superpowers/plans/2026-08-29-bullmq-email-jobs.md .env.example
git commit -m "Document BullMQ email operations" -m "Explain local API and worker startup, transactional email delivery, OTP protection, retry retention, and operational verification."
```
