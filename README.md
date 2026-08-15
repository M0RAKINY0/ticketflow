# Ventra Ticketing

Ventra is an event-ticketing application built with React, Node.js, Express, TypeScript, PostgreSQL, Prisma, and JWT authentication. Organizers create capacity-limited events, attendees discover events and reserve tickets, and event staff perform one-time QR check-ins.

The product uses a Vite React application in `web/` and a single Express API. Reservation inventory and check-in correctness rely on PostgreSQL conditional updates and unique constraints; there is no Redis, job worker, payment system, Docker, or Nginx layer.

## Capabilities

- Public registration, login, refresh-token rotation, logout, and access JWTs.
- `USER`, `ORGANIZER`, and `ADMIN` role authorization.
- Organizer-owned draft event and ticket-type management.
- Paginated public discovery of upcoming published events by search, category, date, and country.
- Responsive discovery-first web shell with desktop and mobile navigation.
- Same-origin browser sessions with access tokens kept only in memory.
- Atomic capacity enforcement and per-user idempotent reservations.
- Synchronous QR generation stored as a PNG data URL on each ticket.
- Attendee reservation, ticket, and QR retrieval.
- Organizer/admin ticket validation with exactly-once check-in.
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
npm run test:web
npm run typecheck:web
npm run build:web
```

## Web application

The React workspace lives in `web/`. It uses React Router for attendee, organizer, and admin route boundaries; TanStack Query for server state; Tailwind-backed design tokens; Radix primitives; and a self-hosted Manrope variable font. The approved visual direction is a near-white discovery canvas with graphite typography and electric-indigo actions.

Public discovery owns its state in URL parameters: `q`, `category`, `from`, `to`, `country`, and `page`. Event cards and detail screens format dates in the event's IANA timezone and prices in its ISO currency. Login and registration preserve a safe internal return path. Each ticket reservation intent creates one browser UUID sent as `Idempotency-Key`; retrying the same event and ticket type reuses that key, while changing either creates a new intent.

Offline ticket records use IndexedDB database `ventra`, store `tickets`, and the compound key `[userId, ticketId]`. Records are never returned across users, and logout purges the active user's cached signed QR material before the session is removed from the interface.

Start the API on port `4000`, then run the Vite development server in a second terminal:

```bash
npm run dev
npm run dev:web
```

Vite proxies `/api` and `/health` to `http://localhost:4000`, so cookies remain same-origin in development. Browser refresh credentials stay in an `HttpOnly` cookie, while the short-lived access token exists only in module memory and is renewed through a single-flight refresh request.

## Authentication

Authentication endpoints are under `/api/v1/auth`:

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`

Public registration always creates a `USER`, regardless of extra fields in the request. Registration and login return the access token and public user in JSON; access tokens are sent as `Authorization: Bearer <token>`. The refresh credential is an opaque token issued only in the `ventra_refresh` cookie with `HttpOnly`, `SameSite=Lax`, a 30-day lifetime, an auth-scoped path, and `Secure` in production. Refresh rotates that cookie without a JSON body, and logout revokes and clears it.

Only an `ADMIN` may call `GET /api/v1/users` or `PATCH /api/v1/users/:userId/role`. The list endpoint accepts `query`, `role`, `page`, and `pageSize`, returns public fields only, and limits page size to 100. Role assignment accepts only `USER` or `ORGANIZER`; the public API never assigns `ADMIN`.

## Ticketing API

All routes below use the `/api/v1` prefix.

| Method   | Path                                          | Access                | Behavior                                                                                                          |
| -------- | --------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/events`                                     | Public; optional auth | Paginated discovery; public users see upcoming published events, organizers see their events, and admins see all. |
| `GET`    | `/events/:eventId`                            | Public; optional auth | Published events are public; owners and admins can inspect non-public events.                                     |
| `POST`   | `/events`                                     | Organizer             | Creates a draft event.                                                                                            |
| `PATCH`  | `/events/:eventId`                            | Owning organizer      | Updates a draft event.                                                                                            |
| `POST`   | `/events/:eventId/publish`                    | Owning organizer      | Publishes a draft with at least one ticket type.                                                                  |
| `POST`   | `/events/:eventId/cancel`                     | Owning organizer      | Cancels a draft or published event.                                                                               |
| `GET`    | `/events/:eventId/ticket-types`               | Public; optional auth | Lists ticket types when the event is visible.                                                                     |
| `POST`   | `/events/:eventId/ticket-types`               | Owning organizer      | Adds a ticket type to a draft.                                                                                    |
| `PATCH`  | `/events/:eventId/ticket-types/:ticketTypeId` | Owning organizer      | Updates a ticket type on a draft.                                                                                 |
| `DELETE` | `/events/:eventId/ticket-types/:ticketTypeId` | Owning organizer      | Deletes a ticket type from a draft.                                                                               |
| `POST`   | `/events/:eventId/reservations`               | User                  | Reserves one ticket for a published event.                                                                        |
| `GET`    | `/me/reservations`                            | Authenticated         | Lists the caller's reservations.                                                                                  |
| `GET`    | `/me/tickets`                                 | Authenticated         | Lists the caller's tickets.                                                                                       |
| `GET`    | `/me/tickets/:ticketId`                       | Ticket owner          | Returns one ticket.                                                                                               |
| `GET`    | `/me/tickets/:ticketId/qr`                    | Ticket owner          | Returns the stored QR data URL and signed payload.                                                                |
| `POST`   | `/events/:eventId/check-ins`                  | Owner or admin        | Validates a signed QR payload and consumes the ticket once.                                                       |
| `GET`    | `/events/:eventId/check-ins`                  | Owner or admin        | Lists event check-ins.                                                                                            |

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

`GET /api/v1/events` accepts `query`, `category`, `from`, `to`, `countryCode`, `page`, and `pageSize`. Page size defaults to 20 and is limited to 100. Search is case-insensitive across title, venue, city, and organizer name. The response is:

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
