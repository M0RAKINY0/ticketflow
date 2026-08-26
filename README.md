# Ventra Ticketing

This repository contains the Ventra event-ticketing API. It uses Node.js, Express, TypeScript, PostgreSQL, Prisma, and Better Auth. Users discover events, reserve tickets, create and manage their own events, and perform event-scoped QR check-ins. Admins manage the whole system.

The frontend lives in a separate repository. This repository owns the API, database schema, migrations, and backend tests. Reservation inventory and check-in correctness rely on PostgreSQL conditional updates and unique constraints. There is no Redis, job worker, payment system, Docker, or Nginx layer.

## Capabilities

- Email and password authentication, Google OAuth, database sessions, and short-lived JWTs.
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
HOST=127.0.0.1
FRONTEND_ORIGINS=http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
DATABASE_URL=postgresql://ventra:ventra@localhost:5432/ventra
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
TICKET_QR_SECRET=replace-with-at-least-32-characters
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

Pull requests targeting `main` run the full test suite, type checking, and production build in GitHub Actions. CI starts an isolated PostgreSQL service and applies all Prisma migrations before running tests.

## HTTP composition

`src/app.ts` installs secure headers, the browser-origin allowlist, request throttling, the Better Auth handler, cookie parsing, size-limited JSON parsing, the root router, and safe error responses. The Better Auth handler runs before the JSON parser so it can read the original request body. `src/server.ts` sets explicit HTTP timeouts. `src/routes/index.ts` mounts health, users, and ticketing routes. Shared HTTP security, authentication, and error handling live in `src/middleware/`.

## MVC module boundaries

Users and ticketing live under `src/modules/`. Better Auth owns authentication endpoints through `src/infrastructure/auth.ts`. Each Ventra feature has a clear job at every layer:

- Route files declare endpoint paths and spread feature middleware arrays before controllers. They call controllers and do not call services directly.
- Controllers translate HTTP requests into feature calls. They validate input with the feature schemas, choose status codes, manage cookies where needed, and return the standard response envelopes.
- Services enforce business rules and coordinate work. Ticketing services keep publication, reservation, and check-in transaction callbacks here because those operations depend on related conditional writes succeeding together.
- Models own standalone Prisma operations. `ticketingModel` uses the root Prisma client, while ticketing service callbacks keep their direct transaction-client reads and writes for conditional operations.
- Schemas define and parse each feature's request data. They stay next to the feature that uses them.
- Feature middleware composes shared authentication and role checks into feature access chains. Shared middleware accepts Better Auth session cookies or JWT bearer tokens and applies Ventra role checks.

Prisma's database schema and migrations remain under `prisma/`. Feature model files use the generated Prisma client at runtime; they do not replace the schema or migrations.

## Authentication

Authentication endpoints are under `/api/v1/auth`:

- `POST /sign-up/email`
- `POST /sign-in/email`
- `POST /sign-in/social`
- `GET /callback/google`
- `GET /get-session`
- `POST /sign-out`
- `GET /token`
- `GET /jwks`

Public registration always creates a `USER`, even if the request supplies a role. Password hashes live only in Better Auth `Account` rows. Google uses `http://localhost:4000/api/v1/auth/callback/google` during development. Browser clients authenticate with Better Auth's HTTP-only session cookie. An authenticated session may request a 15-minute JWT from `/token`; API clients send it as `Authorization: Bearer <token>`. Protected Ventra routes accept either credential.

`phoneNumber` is optional. Better Auth sessions last 30 days and update their activity timestamp once per day. Production cookies use `Secure`. Google and Better Auth secrets belong in `.env` or the deployment secret manager and must never be committed.

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
