# Ventra Ticketing Backend Design

## Purpose

Ventra is an event ticketing system. Authenticated users create and publish events with ticket categories, attendees reserve available tickets and receive QR-coded passes, and event owners validate those passes at venue check-in. The implementation must match the repository README and does not include payment processing.

## Product Scope

Ventra must provide:

- JWT authentication with rotated, revocable refresh tokens.
- Role-based access control for `USER` and `ADMIN` accounts.
- Event-owner and administrator event and ticket-type management.
- Public discovery of published events.
- Transactional ticket reservations that cannot oversell inventory.
- Unique QR-coded digital tickets generated asynchronously.
- One-time ticket validation and check-in.
- Redis-backed caching, rate limiting, and BullMQ processing.
- Structured request logging and centralized error handling.
- Docker packaging for the API, worker, Redis, and Nginx, but not PostgreSQL.
- Automated tests, including reservation-concurrency and duplicate-check-in coverage.

Payments and a web frontend are explicitly outside this delivery.

## Architecture

Ventra will be a modular monolith written in TypeScript. One codebase produces two runtime processes:

1. The Express API handles HTTP requests, authentication, authorization, validation, event management, reservations, ticket retrieval, and check-in.
2. The BullMQ worker consumes ticket-generation jobs and creates QR pass images.

Feature modules own their routes, schemas, services, and repositories. Shared infrastructure provides configuration, Prisma, Redis, queues, logging, HTTP errors, and middleware. This keeps feature boundaries explicit without the deployment and consistency costs of microservices.

The modules are:

- `auth`: registration, login, access-token issuance, refresh-token rotation, and logout.
- `users`: authenticated profile access and administrative role management.
- `events`: user-owned event creation, editing, publication, cancellation, and public discovery.
- `ticket-types`: event ticket categories, capacity, labels, and availability.
- `reservations`: idempotent transactional reservation and cancellation rules.
- `tickets`: ticket issuance state and QR pass retrieval.
- `check-ins`: ticket validation and immutable admission records.
- `infrastructure`: configuration, database, Redis, queues, rate limits, logging, and errors.

## Data Model

### User

Stores identity, password hash, contact fields, role, and timestamps. New public registrations always receive the `USER` role. Only an administrator can assign elevated roles.

### Event

Stores title, description, start and end times, venue, status, event-owner ownership, and timestamps. Event status is `DRAFT`, `PUBLISHED`, or `CANCELLED`. Only published events are publicly discoverable.

### TicketType

Stores an event-specific category name, optional description, display price, capacity, reserved count, and timestamps. The display price is informational because payment processing is outside scope. Capacity cannot be reduced below the number already reserved.

### Reservation

Connects an attendee, event, and ticket type. It stores status, an idempotency key, and timestamps. The attendee-and-idempotency-key combination is unique so safe retries cannot create duplicate tickets.

### Ticket

Stores the unique opaque public identifier, reservation relationship, issuance status, QR image location or encoded representation, usage state, and timestamps. The QR payload contains no attendee personal data.

### CheckIn

Stores the ticket, event, event owner or admin who performed validation, and check-in time. A unique ticket constraint ensures that a ticket can be admitted only once.

### RefreshToken

Stores a hash of each refresh token, its owner, expiry, revocation state, replacement relationship, and timestamps. Raw refresh tokens are never persisted.

## Authorization Rules

- Public clients can register, log in, refresh sessions, and list or view published events.
- Users can view their profile, reserve tickets, list their reservations and tickets, and retrieve their QR passes.
- Authenticated users can manage only events they own, including ticket types, attendee summaries, and check-ins.
- Admins can manage all users and events.
- Role and ownership checks live in services and are reinforced at route boundaries.

## HTTP API

All endpoints are versioned under `/api/v1`. Successful responses use `{ "data": ... }`. Errors use `{ "error": { "code": string, "message": string, "requestId": string, "details"?: unknown } }`.

### Authentication

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Access tokens are short lived. Refreshing rotates the refresh token and revokes the previous token. Logout revokes the active refresh token.

### Events and ticket types

- `GET /api/v1/events`
- `GET /api/v1/events/:eventId`
- `POST /api/v1/events`
- `PATCH /api/v1/events/:eventId`
- `POST /api/v1/events/:eventId/publish`
- `POST /api/v1/events/:eventId/cancel`
- `GET /api/v1/events/:eventId/ticket-types`
- `POST /api/v1/events/:eventId/ticket-types`
- `PATCH /api/v1/events/:eventId/ticket-types/:ticketTypeId`
- `DELETE /api/v1/events/:eventId/ticket-types/:ticketTypeId`

### Reservations and tickets

- `POST /api/v1/events/:eventId/reservations`
- `GET /api/v1/me/reservations`
- `GET /api/v1/me/tickets`
- `GET /api/v1/me/tickets/:ticketId`
- `GET /api/v1/me/tickets/:ticketId/qr`

Reservation creation requires an `Idempotency-Key` header. A successful database transaction increments inventory, creates the reservation, creates a pending ticket, and enqueues QR generation. The worker marks the ticket ready after producing its pass.

### Check-in and operations

- `POST /api/v1/events/:eventId/check-ins`
- `GET /api/v1/events/:eventId/check-ins`
- `GET /health`
- `GET /ready`

Check-in accepts the opaque QR payload. A transaction verifies ticket status and event ownership, creates a check-in record, and marks the ticket used. Repeated scans return `409 Conflict`.

## Consistency and Concurrency

Reservation creation uses a PostgreSQL transaction with an atomic conditional inventory update. The update succeeds only when `reservedCount < capacity`; otherwise Ventra returns a sold-out conflict. Reservation, ticket, and inventory updates commit together. Unique constraints provide a second line of defense for idempotency.

Check-in also uses a transaction. The unique check-in constraint and ticket state transition prevent concurrent scanners from accepting the same pass twice.

## QR Processing

Each ticket receives a cryptographically random public identifier. The QR code encodes a signed, opaque validation payload derived from that identifier and contains no email, phone number, name, or internal database identifier.

BullMQ performs QR generation outside the request path. The API creates a pending ticket and enqueues a deterministic job keyed by ticket ID. Jobs are safe to retry. Generated QR images are stored through a small storage interface; the initial implementation uses application-managed local storage and can be replaced by durable object storage without changing ticket-domain logic.

## Redis Responsibilities

Redis is used for:

- BullMQ queues and worker coordination.
- Request rate limits, with stricter policies for authentication, reservation, and check-in routes.
- Short-lived caching of public event lists and event details.

Event mutations invalidate affected cache keys. Redis is not the source of truth for ticket inventory or check-in state.

## Validation, Errors, and Logging

Zod validates environment configuration, route parameters, headers, and request bodies. Centralized middleware maps domain errors to stable HTTP codes and hides stack traces and database details from clients.

Pino produces structured JSON logs with request IDs. Passwords, authorization headers, refresh tokens, and QR payloads are redacted. Unexpected failures are logged once at the request boundary.

## Testing Strategy

Vitest and Supertest provide unit and HTTP integration tests. The suite covers:

- Input validation, token rotation, authorization, ownership, and error mapping.
- Event lifecycle and ticket-capacity rules.
- Idempotent reservation retries.
- Concurrent reservations proving capacity cannot be exceeded.
- QR job generation and ticket readiness.
- Invalid, cancelled, and duplicate check-ins.
- Cache invalidation and rate-limit behavior.
- A smoke flow from registration through successful check-in.

Integration tests use `TEST_DATABASE_URL`, never `DATABASE_URL`. Test startup must reject a missing test URL or one equal to the non-test URL. Redis tests use a separately configured test namespace or database.

## Deployment

Development and production PostgreSQL are external services configured through `DATABASE_URL`; the application will not define or start PostgreSQL in Docker Compose.

The repository will include:

- A multi-stage, non-root Docker image shared by the API and worker.
- Docker Compose services for the API, BullMQ worker, Redis, and Nginx only.
- Nginx reverse-proxy configuration suitable for multiple API replicas.
- Explicit Prisma migration commands for the configured external database.
- Graceful shutdown of HTTP, Prisma, Redis, queues, and workers.
- CI checks for dependency installation, formatting or linting, type checking, unit/integration tests, and production build. CI may use an isolated PostgreSQL service for tests; this does not make PostgreSQL part of the application Docker deployment.

## Delivery Chunks

1. Foundation, configuration, database model, migrations, and test harness.
2. Authentication, token lifecycle, and role authorization.
3. Events and ticket-type management.
4. Transactional reservations and inventory protection.
5. BullMQ QR generation and ticket retrieval.
6. Ticket validation and one-time check-in.
7. Caching, rate limiting, structured logging, and centralized errors.
8. Docker packaging, Redis and Nginx orchestration, CI, and final documentation.

Each chunk must begin with failing behavioral tests, end with its relevant tests passing, and receive a focused commit. Before publication, the complete test, type-check, and build commands must pass from a clean dependency installation.
