# Ventra Ticketing

This repository contains the Ventra event-ticketing API. It uses Node.js, Express, TypeScript, PostgreSQL, Prisma, and JWT authentication. Users discover events, reserve tickets, create and manage their own events, and perform event-scoped QR check-ins. Admins manage the whole system.

The frontend lives in a separate repository. This repository owns the API, database schema, migrations, and backend tests. Reservation inventory and check-in correctness rely on PostgreSQL conditional updates and unique constraints. There is no Redis, job worker, payment system, Docker, or Nginx layer.

## Capabilities

- Public registration, login, refresh-token rotation, logout, and access JWTs.
- Two account types: `USER` and `ADMIN`.
- Authenticated users own the events they create; admins can manage every event and user.
- Paginated public discovery of upcoming published events by search, category, date, and country.
- Atomic capacity enforcement and per-user idempotent reservations.
- Synchronous QR generation stored as a PNG data URL on each ticket.
- Attendee reservation, ticket, and QR retrieval.
- Event-owner/admin ticket validation with exactly-once check-in.
- Stable `{ "data": ... }` success and `{ "error": { "code", "message" } }` error envelopes.

## Requirements

- Node.js 24 or newer.
- PostgreSQL.

Install dependencies:

```bash
npm install
```

Configure the service with environment variables:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ventra
ACCESS_TOKEN_SECRET=replace-with-at-least-32-characters
REFRESH_TOKEN_SECRET=replace-with-at-least-32-characters
```

For integration tests, also set `TEST_DATABASE_URL` to a separate database. Test mode rejects a test URL that is missing or equal to `DATABASE_URL`.

Generate the client, apply migrations, and start development:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Useful verification commands:

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```

## HTTP composition

`src/app.ts` installs cookie parsing, JSON parsing, the root router, and the error handler. `src/routes/index.ts` mounts health, auth, users, and ticketing routes. Shared authentication and error handling live in `src/middleware/`.

## MVC module boundaries

Auth, users, and ticketing live under `src/modules/`. Each feature has a clear job at every layer:

- Route files declare endpoint paths and attach authentication or role middleware. They call controllers and do not call services directly.
- Controllers translate HTTP requests into feature calls. They validate input with the feature schemas, choose status codes, manage cookies where needed, and return the standard response envelopes.
- Services enforce business rules and coordinate work. Ticketing services keep publication, reservation, and check-in transaction callbacks here because those operations depend on related conditional writes succeeding together.
- Models own runtime database access. They contain the feature's reusable Prisma reads and writes and accept an existing Prisma transaction client when a service needs them inside a transaction.
- Schemas define and parse each feature's request data. They stay next to the feature that uses them.
- Middleware handles shared cross-cutting HTTP work such as bearer-token authentication, role checks, and error responses.

Prisma's database schema and migrations remain under `prisma/`. Feature model files use the generated Prisma client at runtime; they do not replace the schema or migrations.

## Authentication

Authentication endpoints are under `/api/v1/auth`:

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`

Public registration always creates a `USER`, regardless of extra fields in the request. Registration and login return the access token and public user in JSON; access tokens are sent as `Authorization: Bearer <token>`. The refresh credential is an opaque token issued only in the `ventra_refresh` cookie with `HttpOnly`, `SameSite=Lax`, a 30-day lifetime, an auth-scoped path, and `Secure` in production. Refresh rotates that cookie without a JSON body, and logout revokes and clears it.

Only an `ADMIN` may call `GET /api/v1/users` or `PATCH /api/v1/users/:userId/role`. The list endpoint accepts `query`, `role`, `page`, and `pageSize`, returns public fields only, and limits page size to 100. Role assignment accepts only `USER` or `ADMIN`; public registration always creates `USER`. Existing `ORGANIZER` records are converted to `USER` by the role migration.

## Ticketing API

All routes below use the `/api/v1` prefix.

| Method   | Path                                          | Access                | Behavior                                                                                                                                  |
| -------- | --------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/events`                                     | Public; optional auth | Paginated discovery; anonymous visitors see upcoming published events, authenticated users also see their own events, and admins see all. |
| `GET`    | `/events/:eventId`                            | Public; optional auth | Published events are public; owners and admins can inspect non-public events.                                                             |
| `POST`   | `/events`                                     | Authenticated user    | Creates a draft event owned by the caller.                                                                                                |
| `PATCH`  | `/events/:eventId`                            | Owner or admin        | Updates a draft event.                                                                                                                    |
| `POST`   | `/events/:eventId/publish`                    | Owner or admin        | Publishes a draft with at least one ticket type.                                                                                          |
| `POST`   | `/events/:eventId/cancel`                     | Owner or admin        | Cancels a draft or published event.                                                                                                       |
| `GET`    | `/events/:eventId/ticket-types`               | Public; optional auth | Lists ticket types when the event is visible.                                                                                             |
| `POST`   | `/events/:eventId/ticket-types`               | Owner or admin        | Adds a ticket type to a draft.                                                                                                            |
| `PATCH`  | `/events/:eventId/ticket-types/:ticketTypeId` | Owner or admin        | Updates a ticket type on a draft.                                                                                                         |
| `DELETE` | `/events/:eventId/ticket-types/:ticketTypeId` | Owner or admin        | Deletes a ticket type from a draft.                                                                                                       |
| `POST`   | `/events/:eventId/reservations`               | User                  | Reserves one ticket for a published event.                                                                                                |
| `GET`    | `/me/reservations`                            | Authenticated         | Lists the caller's reservations.                                                                                                          |
| `GET`    | `/me/tickets`                                 | Authenticated         | Lists the caller's tickets.                                                                                                               |
| `GET`    | `/me/tickets/:ticketId`                       | Ticket owner          | Returns one ticket.                                                                                                                       |
| `GET`    | `/me/tickets/:ticketId/qr`                    | Ticket owner          | Returns the stored QR data URL and signed payload.                                                                                        |
| `POST`   | `/events/:eventId/check-ins`                  | Owner or admin        | Validates a signed QR payload and consumes the ticket once.                                                                               |
| `GET`    | `/events/:eventId/check-ins`                  | Owner or admin        | Lists event check-ins.                                                                                                                    |

Reservation requests require an `Idempotency-Key` header and a JSON body:

```json
{ "ticketTypeId": "uuid" }
```

The first successful request returns `201`; replaying the same user, key, event, and ticket type returns the original reservation with `200` and does not increment inventory. Reusing the key for a different request returns `409`.

Check-in requests accept the payload read from the ticket's QR code:

```json
{ "qrPayload": "opaque-ticket-id.hmac-signature" }
```

The QR contains no attendee or event data. Its opaque ticket identifier is signed with HMAC, and a conditional ticket-state transition ensures concurrent scans cannot both succeed.

### Global event data and discovery

Event create requests require a category, display city, ISO 3166-1 alpha-2 country code, ISO 4217 currency, and IANA timezone. `coverImageUrl` is optional and, when present, must use HTTPS. `startsAt` and `endsAt` remain offset-bearing ISO timestamps stored as UTC instants; the timezone tells clients how to render authoritative event-local time.

```json
{
  "title": "Lagos Live",
  "description": "An evening of live music.",
  "startsAt": "2030-06-01T18:00:00.000Z",
  "endsAt": "2030-06-01T22:00:00.000Z",
  "venue": "Civic Centre",
  "category": "MUSIC",
  "coverImageUrl": "https://images.example.com/lagos-live.jpg",
  "city": "Lagos",
  "countryCode": "NG",
  "currency": "NGN",
  "timezone": "Africa/Lagos"
}
```

`GET /api/v1/events` accepts `query`, `category`, `from`, `to`, `countryCode`, `page`, and `pageSize`. Page size defaults to 20 and is limited to 100. Search is case-insensitive across title, venue, city, and event-owner name. The response is:

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

Supported categories are `MUSIC`, `BUSINESS`, `TECHNOLOGY`, `ARTS_CULTURE`, `FOOD_DRINK`, `SPORTS_FITNESS`, `COMMUNITY`, `EDUCATION`, and `OTHER`.

## Data integrity

PostgreSQL is the concurrency authority:

- `TicketType.reservedCount` is incremented only when it remains below `capacity`.
- `(userId, idempotencyKey)` is unique for reservations.
- Each reservation owns at most one ticket, and ticket public IDs are unique.
- Ticket status changes from `READY` to `USED` through a conditional update.
- `CheckIn.ticketId` is unique as a second exactly-once safeguard.
- Generated PNG QR data URLs are stored durably in `Ticket.qrCodeDataUrl`.
