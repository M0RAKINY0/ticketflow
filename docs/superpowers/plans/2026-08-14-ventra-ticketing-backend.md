# Ventra Ticketing Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the README-defined backend that lets organizers publish capacity-limited events, attendees reserve QR-coded tickets, and organizers perform one-time check-ins.

**Architecture:** Implement a TypeScript modular monolith with feature-owned routes, schemas, services, and repositories. Run the same codebase as an Express API and a BullMQ QR worker; PostgreSQL remains the transactional source of truth while Redis provides queues, caching, and distributed rate limits.

**Tech Stack:** Node.js 24+, Express 5, TypeScript 6, Prisma 7 with PostgreSQL, Zod 4, JWT, bcrypt, BullMQ, ioredis, QRCode, Pino, Vitest, Supertest, Docker Compose, and Nginx.

## Global Constraints

- Follow `docs/superpowers/specs/2026-08-14-ventra-ticketing-backend-design.md` and the repository `README.md`.
- Deliver a backend-only REST API; do not add payment processing or a frontend.
- Do not run PostgreSQL from the application Docker Compose file.
- Use `DATABASE_URL` for development/production and a distinct `TEST_DATABASE_URL` for integration tests.
- Preserve transactional inventory and one-time check-in guarantees in PostgreSQL, not Redis.
- New public registrations always receive the `USER` role.
- QR payloads must not contain attendee personal data or internal database identifiers.
- Add production code only after the corresponding behavioral test has failed for the expected reason.
- End every task with its focused tests, the complete test suite, type-check, and build passing before committing.

---

## Target File Map

```text
prisma/
  schema.prisma                 Complete domain data model and constraints
  migrations/                  Versioned PostgreSQL migrations
src/
  app.ts                       Express composition without listening
  server.ts                    API startup and graceful shutdown
  worker.ts                    BullMQ worker startup and shutdown
  config/env.ts                Zod-validated environment
  infrastructure/
    prisma.ts                  Prisma adapter/client lifecycle
    redis.ts                   Redis lifecycle and namespaced clients
    queue.ts                   Ticket QR queue and worker factory
    logger.ts                  Redacted Pino logger
    qr-storage.ts              QR storage interface and local implementation
  shared/
    errors.ts                  Typed domain/HTTP errors
    async-handler.ts           Express async boundary
    auth.ts                    JWT middleware and role guard
    response.ts                Stable success/error response helpers
  modules/{auth,users,events,ticket-types,reservations,tickets,check-ins}/
    *.schema.ts                Zod input schemas
    *.repository.ts            Prisma persistence operations
    *.service.ts               Domain rules and authorization
    *.routes.ts                Express routes
tests/
  setup/                       Safe test DB/Redis setup and teardown
  unit/                        Pure behavior tests
  integration/                 HTTP, transaction, queue, and smoke tests
docker/
  nginx.conf                   Reverse proxy and API upstream
Dockerfile                     Multi-stage non-root API/worker image
compose.yaml                   API, worker, Redis, and Nginx only
.github/workflows/ci.yml        Install, generate, migrate, test, type-check, build
```

## Data Contract

Use Prisma enums `Role(USER, ORGANIZER, ADMIN)`, `EventStatus(DRAFT, PUBLISHED, CANCELLED)`, `ReservationStatus(CONFIRMED, CANCELLED)`, and `TicketStatus(PENDING, READY, USED, VOID)`. Store all IDs as UUID strings and all timestamps in UTC.

Required relations and constraints:

- `User.email` unique; `User.role` defaults to `USER`.
- `Event.organizerId -> User.id`; index organizer and public status/start-time queries.
- `TicketType.eventId -> Event.id`; `capacity >= 1`; `reservedCount` defaults to zero.
- `Reservation.userId`, `eventId`, and `ticketTypeId` foreign keys; unique `(userId, idempotencyKey)`.
- `Ticket.reservationId` unique; `Ticket.publicId` unique.
- `CheckIn.ticketId` unique; retain `eventId` and `checkedInById` for immutable audit queries.
- `RefreshToken.tokenHash` unique; store expiry, revocation time, and optional replacement link.

---

### Task 1: Foundation, Configuration, Schema, and Test Harness

**Files:**
- Modify: `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `prisma.config.ts`, `prisma/schema.prisma`, `app.ts`
- Create: `.env.example`, `src/config/env.ts`, `src/infrastructure/prisma.ts`, `src/shared/errors.ts`, `src/shared/response.ts`, `src/app.ts`, `src/server.ts`
- Create: `vitest.config.ts`, `tests/setup/env.ts`, `tests/unit/env.test.ts`, `tests/integration/health.test.ts`
- Create: `prisma/migrations/<timestamp>_initial/migration.sql`

**Interfaces:**
- Produces: `env`, `prisma`, `AppError`, `createApp(): Express`, `startServer(): Promise<void>`.
- Consumes: external PostgreSQL URLs supplied through environment variables.

- [ ] **Step 1: Install and normalize dependencies**

Run `npm install` followed by:

```powershell
npm install @prisma/adapter-pg bullmq helmet ioredis pino pino-http rate-limit-redis express-rate-limit
npm install -D @types/qrcode @types/supertest pino-pretty prettier supertest tsx vitest
```

Replace the placeholder scripts with `dev`, `worker:dev`, `build`, `start`, `worker`, `typecheck`, `format`, `format:check`, `test`, `test:unit`, `test:integration`, `prisma:generate`, `prisma:migrate`, and `prisma:migrate:test`. Set package type to `module`, main to `dist/server.js`, engines to Node `>=24`, and use `tsx` for development/test setup.

- [ ] **Step 2: Write failing environment and health tests**

```ts
it('rejects an integration database equal to the application database', () => {
  expect(() => parseEnv({
    NODE_ENV: 'test', PORT: '4000', DATABASE_URL: POSTGRES_URL,
    TEST_DATABASE_URL: POSTGRES_URL, REDIS_URL: 'redis://localhost:6379',
    ACCESS_TOKEN_SECRET: SECRET_A, REFRESH_TOKEN_SECRET: SECRET_B,
  })).toThrow(/TEST_DATABASE_URL must differ/);
});

it('returns liveness without requiring authentication', async () => {
  const response = await request(createApp()).get('/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: { status: 'ok' } });
});
```

Run `npm run test:unit -- tests/unit/env.test.ts` and `npm run test:integration -- tests/integration/health.test.ts`. Confirm failures report missing `parseEnv` and `createApp` behavior.

- [ ] **Step 3: Implement validated configuration and app composition**

Implement `parseEnv(input: NodeJS.ProcessEnv): Env` with Zod, normalize the current lowercase secret names to uppercase names in `.env.example`, enforce secrets of at least 32 characters, and select `TEST_DATABASE_URL` when `NODE_ENV === 'test'`. Implement the response envelope and `/health`; keep `app.listen` only in `src/server.ts`.

- [ ] **Step 4: Replace the draft schema with the complete data contract**

Define the four enums and seven models described above, including cascading behavior, indexes, unique constraints, timestamps, and numeric checks in the SQL migration. Configure Prisma 7 through `@prisma/adapter-pg`. Generate the client and create the initial migration against `DATABASE_URL`.

- [ ] **Step 5: Verify the foundation**

Run:

```powershell
npm run prisma:generate
npm run test:unit -- tests/unit/env.test.ts
npm run test:integration -- tests/integration/health.test.ts
npm run typecheck
npm run build
```

Expected: all commands exit zero; the health response matches the envelope; the generated client compiles.

- [ ] **Step 6: Commit the foundation**

```powershell
git add package.json package-lock.json tsconfig.json .gitignore .env.example prisma.config.ts prisma/schema.prisma prisma/migrations app.ts src/config src/infrastructure/prisma.ts src/shared src/app.ts src/server.ts vitest.config.ts tests/setup tests/unit/env.test.ts tests/integration/health.test.ts
git commit -m "build: establish Ventra backend foundation"
```

---

### Task 2: Authentication, Refresh Rotation, and Role Authorization

**Files:**
- Replace: `src/services/auth.ts`, `src/utilities/token.ts`
- Create: `src/modules/auth/auth.schema.ts`, `auth.repository.ts`, `auth.service.ts`, `auth.routes.ts`
- Create: `src/modules/users/users.repository.ts`, `users.service.ts`, `users.routes.ts`
- Create: `src/shared/auth.ts`, `tests/unit/token.test.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `env`, `prisma`, `AppError`, and `createApp()`.
- Produces: `signAccessToken(user)`, `issueRefreshToken(userId)`, `rotateRefreshToken(rawToken)`, `authenticate`, `requireRole(...roles)`.

- [ ] **Step 1: Write failing token and registration tests**

```ts
it('ignores a role supplied by a public registrant', async () => {
  const response = await request(app).post('/api/v1/auth/register').send({
    email: 'guest@example.com', name: 'Guest', phoneNumber: '+2348000000000',
    password: 'Correct-Horse-42', role: 'ADMIN',
  });
  expect(response.status).toBe(201);
  expect(response.body.data.user.role).toBe('USER');
});

it('revokes the previous refresh token when rotating', async () => {
  const first = await issueRefreshToken(user.id);
  const second = await rotateRefreshToken(first.rawToken);
  await expect(rotateRefreshToken(first.rawToken)).rejects.toMatchObject({ statusCode: 401 });
  expect(second.rawToken).not.toBe(first.rawToken);
});
```

Run the two test files and confirm failures are caused by absent endpoints/token functions.

- [ ] **Step 2: Implement password and token lifecycle**

Hash passwords with bcrypt cost 12. Sign 15-minute access tokens containing `sub` and `role`. Generate refresh tokens with `randomBytes(48)`, persist only a SHA-256 hash, expire them after 30 days, and rotate them transactionally. Reject expired, revoked, and reused refresh tokens with `401`.

- [ ] **Step 3: Implement auth and user routes**

Validate registration/login/refresh/logout bodies with Zod. Return access and refresh tokens only from successful auth endpoints. Add `GET /api/v1/me`. Add admin-only `PATCH /api/v1/users/:userId/role`, accepting only `USER` or `ORGANIZER` so API calls cannot create another admin.

- [ ] **Step 4: Verify authentication and authorization**

Run `npm run test -- tests/unit/token.test.ts tests/integration/auth.test.ts`, then `npm run typecheck` and `npm run build`. Expected: invalid credentials are `401`, forbidden role actions are `403`, rotation invalidates the old token, and no response exposes a password hash.

- [ ] **Step 5: Commit authentication**

```powershell
git add src/modules/auth src/modules/users src/shared/auth.ts src/services/auth.ts src/utilities/token.ts tests/unit/token.test.ts tests/integration/auth.test.ts
git commit -m "feat: add authentication and role authorization"
```

---

### Task 3: Event and Ticket-Type Management

**Files:**
- Create: `src/modules/events/events.schema.ts`, `events.repository.ts`, `events.service.ts`, `events.routes.ts`
- Create: `src/modules/ticket-types/ticket-types.schema.ts`, `ticket-types.repository.ts`, `ticket-types.service.ts`, `ticket-types.routes.ts`
- Create: `tests/integration/events.test.ts`, `tests/integration/ticket-types.test.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: authenticated principal `{ userId: string; role: Role }`, Prisma models, and `requireRole`.
- Produces: event/ticket-type CRUD services and public event read endpoints used by reservations.

- [ ] **Step 1: Write failing event lifecycle tests**

```ts
it('shows only published events to public clients', async () => {
  await seedEvent({ status: 'DRAFT' });
  const published = await seedEvent({ status: 'PUBLISHED' });
  const response = await request(app).get('/api/v1/events');
  expect(response.status).toBe(200);
  expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([published.id]);
});

it('prevents an organizer from editing another organizer event', async () => {
  const response = await authed(organizerB).patch(`/api/v1/events/${organizerAEvent.id}`).send({ title: 'Taken over' });
  expect(response.status).toBe(403);
});
```

- [ ] **Step 2: Implement event lifecycle**

Create organizer-owned draft events, validate that end time follows start time, allow edits only while not cancelled, require at least one valid ticket type before publication, and make cancellation terminal. Public queries filter `PUBLISHED` events and support bounded `page`, `pageSize`, and upcoming-date ordering.

- [ ] **Step 3: Write failing capacity-rule tests**

```ts
it('cannot reduce capacity below reserved inventory', async () => {
  const response = await organizer.patch(ticketTypeUrl).send({ capacity: 4 });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('CAPACITY_BELOW_RESERVED');
});
```

Run the tests and confirm the missing rule causes the expected assertion failure.

- [ ] **Step 4: Implement ticket-type rules and routes**

Only the owning organizer or an admin can mutate ticket types. Require capacity of at least one and a non-negative two-decimal display price. Block deletion after any reservation exists. Expose public ticket types only through published events.

- [ ] **Step 5: Verify and commit events**

Run both integration files, the full test suite, type-check, and build. Then:

```powershell
git add src/modules/events src/modules/ticket-types src/app.ts tests/integration/events.test.ts tests/integration/ticket-types.test.ts
git commit -m "feat: add event and ticket type management"
```

---

### Task 4: Transactional Reservations and Inventory Protection

**Files:**
- Create: `src/modules/reservations/reservations.schema.ts`, `reservations.repository.ts`, `reservations.service.ts`, `reservations.routes.ts`
- Create: `tests/integration/reservations.test.ts`, `tests/integration/reservation-concurrency.test.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: published event/ticket type records and authenticated attendee identity.
- Produces: `createReservation(input, principal, idempotencyKey)` returning a confirmed reservation and pending ticket.

- [ ] **Step 1: Write failing idempotency and sold-out tests**

```ts
it('returns the same reservation for a repeated idempotency key', async () => {
  const first = await reserve('retry-key-1');
  const second = await reserve('retry-key-1');
  expect(second.status).toBe(200);
  expect(second.body.data.reservation.id).toBe(first.body.data.reservation.id);
});

it('never confirms more reservations than capacity', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) => reserve(`parallel-${index}`)));
  expect(results.filter(result => result.status === 201)).toHaveLength(10);
  expect(results.filter(result => result.status === 409)).toHaveLength(2);
});
```

- [ ] **Step 2: Implement atomic reservation persistence**

Inside a Prisma transaction, execute a conditional ticket-type update equivalent to `reservedCount = reservedCount + 1 WHERE id = ? AND reservedCount < capacity`, then create the confirmed reservation and pending ticket. If the update count is zero, return `SOLD_OUT`. Resolve duplicate idempotency keys by returning the existing reservation without incrementing inventory.

- [ ] **Step 3: Implement reservation routes**

Require `Idempotency-Key`, an authenticated `USER`, a published/non-cancelled event, and a ticket type belonging to that event. Add attendee-scoped `GET /api/v1/me/reservations`. Return `201` for a new reservation and `200` for an idempotent replay.

- [ ] **Step 4: Verify transaction guarantees and commit**

Run the reservation tests repeatedly with `npm run test:integration -- tests/integration/reservation*.test.ts --repeat=3`, then run the full suite, type-check, and build. Commit:

```powershell
git add src/modules/reservations src/app.ts tests/integration/reservations.test.ts tests/integration/reservation-concurrency.test.ts
git commit -m "feat: add transactional ticket reservations"
```

---

### Task 5: BullMQ QR Generation and Ticket Retrieval

**Files:**
- Create: `src/infrastructure/redis.ts`, `src/infrastructure/queue.ts`, `src/infrastructure/qr-storage.ts`
- Create: `src/modules/tickets/ticket-payload.ts`, `tickets.repository.ts`, `tickets.service.ts`, `tickets.routes.ts`, `tickets.worker.ts`
- Create: `src/worker.ts`, `tests/unit/ticket-payload.test.ts`, `tests/integration/tickets-worker.test.ts`, `tests/integration/tickets.test.ts`
- Modify: `src/modules/reservations/reservations.service.ts`, `src/app.ts`, `.gitignore`

**Interfaces:**
- Consumes: pending ticket ID after reservation commit and Redis connectivity.
- Produces: `ticketQrQueue.add('generate', { ticketId }, { jobId: ticketId })`, signed opaque payloads, ready ticket records, and attendee-scoped QR retrieval.

- [ ] **Step 1: Write failing QR privacy and tamper tests**

```ts
it('creates a payload without attendee data and rejects tampering', () => {
  const payload = createTicketPayload({ publicId: PUBLIC_ID }, SIGNING_SECRET);
  expect(payload).not.toContain('guest@example.com');
  expect(verifyTicketPayload(payload, SIGNING_SECRET)).toEqual({ publicId: PUBLIC_ID });
  expect(() => verifyTicketPayload(`${payload}x`, SIGNING_SECRET)).toThrow(/invalid/i);
});
```

- [ ] **Step 2: Implement payload signing and storage boundary**

Use HMAC-SHA256 over a versioned base64url payload containing only `publicId`. Use `timingSafeEqual` for signatures. Define `QrStorage.write(ticketId, png): Promise<string>` and `QrStorage.read(location): Promise<Buffer>`; implement local storage under configured `QR_STORAGE_PATH` with path-safe UUID filenames.

- [ ] **Step 3: Write failing worker retry/idempotency test**

```ts
it('marks a pending ticket ready and is safe to process twice', async () => {
  await processTicketQr({ ticketId: ticket.id }, dependencies);
  await processTicketQr({ ticketId: ticket.id }, dependencies);
  const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
  expect(stored.status).toBe('READY');
  expect(storage.writeCount).toBe(1);
});
```

- [ ] **Step 4: Implement queue, worker, and ticket endpoints**

Enqueue only after the reservation transaction commits. If enqueueing fails, leave the ticket pending; an idempotent reservation replay must detect that pending ticket and enqueue the deterministic job again. Generate PNG through `qrcode`, persist the storage location, and transition `PENDING -> READY`. Add attendee-scoped ticket list/detail routes and a QR endpoint returning `image/png`; return `202` while generation is pending and `404` for another attendee's ticket.

- [ ] **Step 5: Verify and commit ticket issuance**

Run the payload, worker, and ticket tests with an isolated Redis namespace; then full tests, type-check, and build. Commit all ticket, queue, Redis, worker, test, and `.gitignore` changes with `feat: generate QR-coded digital tickets`.

---

### Task 6: One-Time Ticket Check-In

**Files:**
- Create: `src/modules/check-ins/check-ins.schema.ts`, `check-ins.repository.ts`, `check-ins.service.ts`, `check-ins.routes.ts`
- Create: `tests/integration/check-ins.test.ts`, `tests/integration/check-in-concurrency.test.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `verifyTicketPayload`, authenticated organizer/admin identity, and ready ticket records.
- Produces: `checkInTicket(eventId, payload, principal)` and organizer-scoped check-in listings.

- [ ] **Step 1: Write failing validation and duplicate tests**

```ts
it('rejects a second scan of the same ticket', async () => {
  expect((await checkIn(payload)).status).toBe(201);
  const duplicate = await checkIn(payload);
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('TICKET_ALREADY_USED');
});

it('accepts exactly one of two concurrent scans', async () => {
  const results = await Promise.all([checkIn(payload), checkIn(payload)]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
});
```

- [ ] **Step 2: Implement transactional check-in**

Verify payload signature, event match, event ownership, `READY` status, and non-cancelled event. In one transaction, conditionally transition `READY -> USED` and create the unique check-in record. Translate a lost race or unique constraint into `TICKET_ALREADY_USED`.

- [ ] **Step 3: Add check-in routes and listings**

Add organizer/admin-only POST and GET routes under the event. Return attendee-safe ticket summary data, checked-in time, and operator identity; never return QR signatures or password/token fields.

- [ ] **Step 4: Verify and commit check-in**

Run check-in tests repeatedly, then full tests, type-check, and build. Commit the module, tests, and route composition with `feat: add secure one-time ticket check-in`.

---

### Task 7: Caching, Distributed Rate Limits, Logging, and Error Boundaries

**Files:**
- Create: `src/infrastructure/logger.ts`, `src/shared/cache.ts`, `src/shared/rate-limit.ts`, `src/shared/not-found.ts`, `src/shared/error-handler.ts`
- Create: `tests/unit/error-handler.test.ts`, `tests/integration/event-cache.test.ts`, `tests/integration/rate-limit.test.ts`, `tests/integration/log-redaction.test.ts`
- Modify: `src/app.ts`, `src/modules/events/events.service.ts`, `src/server.ts`, `src/worker.ts`

**Interfaces:**
- Consumes: Redis connection and `AppError` subclasses.
- Produces: request IDs, redacted structured logs, stable error envelopes, public event caching, and route-specific distributed rate limiters.

- [ ] **Step 1: Write failing error-envelope and redaction tests**

```ts
it('hides unexpected error details and returns the request id', async () => {
  const response = await request(failingApp).get('/boom').set('x-request-id', 'req-123');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: 'req-123' } });
});

it('does not log authorization credentials', async () => {
  await request(app).get('/health').set('authorization', 'Bearer secret-value');
  expect(logOutput()).not.toContain('secret-value');
});
```

- [ ] **Step 2: Implement middleware order and stable errors**

Compose request ID, Pino HTTP logging with redaction, Helmet, CORS, JSON parsing, routes, not-found, and error middleware in that order. Map Zod to `400`, auth to `401/403`, missing records to `404`, capacity/state conflicts to `409`, rate limits to `429`, and unexpected errors to a generic `500`.

- [ ] **Step 3: Write failing cache and rate-limit tests**

Test that two public event reads hit the repository once, an organizer update invalidates list/detail keys, and the configured auth limit returns `429` after the allowed count. Use unique Redis prefixes so tests do not share counters.

- [ ] **Step 4: Implement Redis cache and rate limits**

Cache public event lists/details with a 60-second TTL. Invalidate event-specific and list-generation keys after event/ticket-type mutations. Configure general, auth, reservation, and check-in limiters with Redis storage and explicit response codes.

- [ ] **Step 5: Add readiness and graceful shutdown**

Make `/ready` verify PostgreSQL and Redis connectivity. On `SIGTERM`/`SIGINT`, stop accepting HTTP traffic, close BullMQ workers/queues, disconnect Redis, and close Prisma; bound shutdown time and return a failing exit code on forced termination.

- [ ] **Step 6: Verify and commit reliability features**

Run the four focused tests, full suite, type-check, and build. Commit infrastructure, shared middleware, composition, and tests with `feat: add caching rate limits and observability`.

---

### Task 8: Deployment, CI, Smoke Coverage, and Documentation

**Files:**
- Create: `Dockerfile`, `compose.yaml`, `.dockerignore`, `docker/nginx.conf`, `.github/workflows/ci.yml`
- Create: `tests/integration/smoke.test.ts`
- Modify: `README.md`, `package.json`, `.env.example`

**Interfaces:**
- Consumes: built `dist/server.js`, `dist/worker.js`, external `DATABASE_URL`, and Redis.
- Produces: reproducible API/worker images, Nginx proxy, CI validation, and operator documentation.

- [ ] **Step 1: Write the failing complete-flow smoke test**

```ts
it('supports registration through one-time check-in', async () => {
  const attendee = await registerUser();
  const organizer = await createOrganizerAsAdmin();
  const event = await createAndPublishEventWithTicketType(organizer);
  const reservation = await reserveTicket(attendee, event, 'smoke-reservation');
  await processTicketQr({ ticketId: reservation.ticket.id }, workerDependencies);
  const storedTicket = await prisma.ticket.findUniqueOrThrow({ where: { id: reservation.ticket.id } });
  const payload = createTicketPayload({ publicId: storedTicket.publicId }, env.QR_SIGNING_SECRET);
  expect((await checkInAs(organizer, event.id, payload)).status).toBe(201);
  expect((await checkInAs(organizer, event.id, payload)).status).toBe(409);
});
```

Run it before adding deployment files and confirm it exposes any missing cross-module behavior; correct those gaps test-first within the owning module.

- [ ] **Step 2: Add production container packaging**

Create a multi-stage Dockerfile that installs from the lockfile, generates Prisma, builds TypeScript, prunes development dependencies, runs as a non-root user, and exposes the API command by default. Compose must define only `api`, `worker`, `redis`, and `nginx`; both Node services receive the external `DATABASE_URL`. Mount one named QR-storage volume into API and worker. Do not define a PostgreSQL service.

- [ ] **Step 3: Add Nginx and CI**

Proxy `/` to the API upstream with forwarded request IDs and conservative timeouts. CI uses Node 24, Redis and an isolated PostgreSQL service, runs `npm ci`, Prisma generation/migration, formatting check, tests, type-check, and build.

- [ ] **Step 4: Rewrite README as executable operations documentation**

Document architecture, prerequisites, environment variables, external PostgreSQL setup, migration commands, development commands, API/worker startup, test database safety, Docker services, endpoint summary, roles, reservation/check-in semantics, and QR storage. Remove claims not implemented by the finished repository.

- [ ] **Step 5: Run final verification from a clean install**

```powershell
npm ci
npm run prisma:generate
npm run format:check
npm run test
npm run typecheck
npm run build
docker compose config
```

Start the configured test PostgreSQL and Redis services, run the smoke test, then inspect `git diff --check` and `git status --short`. Every command must exit zero before publication.

- [ ] **Step 6: Commit deployment and documentation**

```powershell
git add Dockerfile compose.yaml .dockerignore docker .github README.md package.json package-lock.json .env.example tests/integration/smoke.test.ts
git commit -m "ops: add deployment CI and backend documentation"
```

---

## Publication Checklist

- [ ] Confirm only Ventra implementation files are staged; preserve unrelated user changes.
- [ ] Confirm all eight focused commits exist on `agent/ventra-ticketing-backend`.
- [ ] Run the complete clean-install verification commands again immediately before pushing.
- [ ] Push with `git push -u origin agent/ventra-ticketing-backend`.
- [ ] Open a draft pull request to the remote default branch with the architecture, user impact, migrations, environment requirements, and exact validation commands in the description.
