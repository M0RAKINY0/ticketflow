# Ventra Ticketing

This repository contains the Ventra event-ticketing API. It uses Node.js, Express, TypeScript, PostgreSQL, Prisma, Better Auth, and Sentry. Users discover events, reserve tickets, create and manage their own events, and perform event-scoped QR check-ins. Admins manage the whole system.

The frontend lives in a separate repository. This repository owns the API, database schema, migrations, backend tests, and the email worker. Reservation inventory and check-in correctness rely on PostgreSQL conditional updates and unique constraints. Redis stores short-lived authentication data and BullMQ jobs. There is no payment system, Nginx layer, Railway configuration, or RabbitMQ integration.

## Capabilities

- Email and password authentication, Google OAuth, database sessions, and short-lived JWTs.
- Two account types: `USER` and `ADMIN`.
- Authenticated users own the events they create; admins can manage every event and user.
- Paginated public discovery of upcoming published events by search, category, date, and country.
- Guest checkout: anyone can reserve up to 10 tickets with a name and email, with or without an account.
- Atomic capacity enforcement and per-buyer idempotent reservations.
- Synchronous QR generation stored as a PNG data URL on each ticket.
- Unique editable event slugs and public lookup by slug.
- Owner/admin reservation totals, paginated attendees, and CSV export.
- Password reset and guest ticket recovery through queued encrypted email jobs.
- Server verification of Cloudflare Turnstile challenges before checkout.
- One confirmation per reservation, with every ticket QR included.
- Ticket delivery through Resend with the QR displayed inline and attached as a PNG, handled asynchronously after reservation.
- Reservation, ticket, and QR retrieval for signed-in buyers, and by emailed link for guests.
- Event-owner/admin ticket validation with exactly-once check-in.
- Stable `{ "data": ... }` success and `{ "error": { "code", "message" } }` error envelopes.

## Requirements

- Node.js 24 or newer.
- PostgreSQL.
- Redis 7.

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
RESERVATION_RATE_LIMIT_MAX=20
DATABASE_URL=postgresql://ventra:ventra@localhost:5432/ventra
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
TICKET_QR_SECRET=replace-with-at-least-32-characters
SENTRY_DSN=https://public-key@organization.ingest.sentry.io/project-id
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_replace-with-resend-api-key
AUTH_EMAIL_FROM=Ventra <auth@example.com>
```

For integration tests, also set `TEST_DATABASE_URL` to a separate database. Test mode rejects a test URL that is missing or equal to `DATABASE_URL`.

Generate the client, apply migrations, and start development:

```bash
docker compose up -d redis
npm run prisma:generate
npm run prisma:migrate
npm run dev
npm run worker:dev
```

Run `npm run dev` and `npm run worker:dev` in separate terminals. The API accepts HTTP traffic. The worker publishes pending ticket-email outbox records and sends ticket and OTP emails. Redis must use `maxmemory-policy noeviction`; the included Compose configuration already sets it. BullMQ can lose work if Redis evicts queue keys.

Useful verification commands:

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```

The end-to-end queue test uses temporary PostgreSQL and Redis containers on ports `55432` and `56379`. It captures email calls in memory, so it never contacts Resend.

```bash
docker compose -p ventra-e2e -f compose.e2e.yml up -d --wait
NODE_ENV=test DATABASE_URL=postgresql://ventra:ventra@127.0.0.1:5432/ventra TEST_DATABASE_URL=postgresql://ventra:ventra@127.0.0.1:55432/ventra_e2e npx prisma migrate deploy
npm run test:e2e
docker compose -p ventra-e2e -f compose.e2e.yml down
```

The test creates and verifies two users, creates and publishes an event, stops Redis during a reservation, then starts Redis and waits for the outbox and worker to deliver the ticket. It also checks encrypted OTP job data, the stored QR, the ticket job payload, and replay idempotency.

## API documentation

Start the backend, then open `http://localhost:4000/api/docs/` for Swagger UI. The OpenAPI 3.1 JSON contract is available at `http://localhost:4000/api/openapi.json`. The document combines Better Auth's generated authentication operations with Ventra's users, events, ticketing, reservation, and check-in routes.

Pull requests targeting `main` run the full test suite, type checking, and production build in GitHub Actions. CI starts an isolated PostgreSQL service and applies all Prisma migrations before running tests.

## Error reporting

Set `SENTRY_DSN` to enable backend error reporting. Leave it unset to run without Sentry. Test mode never initializes the Sentry SDK, even when a DSN exists.

Sentry receives unexpected server errors and application errors with a status of 500 or higher. Ventra does not report expected client errors such as validation failures, denied origins, malformed JSON, missing resources, or authorization failures. The integration keeps `sendDefaultPii` disabled and performance tracing set to zero. Ventra's existing JSON error responses do not change.

The development and production commands preload `src/instrument.ts` or its compiled output before starting the server. This gives the Sentry SDK a chance to initialize before application modules load. Keep the populated DSN in `.env` or the deployment secret manager; never commit it.

The email worker reports final job failures to Sentry with queue name, job name, job ID, attempt counts, and, for ticket jobs, the ticket ID. It never sends recipient addresses, OTPs, QR data, email content, or raw job data to Sentry.

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

Password signup queues a six-digit verification email for delivery through Resend. Queue records contain an AES-256-GCM encrypted envelope, not the recipient address or code in plaintext. The queued envelope expires after four minutes. Better Auth's code expires after five minutes and becomes invalid after three incorrect attempts. Signup does not create a session until the email is verified through `POST /api/v1/auth/email-otp/verify-email`. Clients can request another verification code through `POST /api/v1/auth/email-otp/send-verification-otp`. Passwordless email sign-in is not supported. Google sign-in is unchanged.

Redis stores OTP verification records and shared Better Auth rate-limit counters under the `ventra:auth:` prefix. User sessions remain in PostgreSQL. The API refuses to start when Redis is unavailable.

The API-wide traffic ceiling remains 100 requests per minute per IP. Better Auth applies tighter limits to sensitive routes: password sign-in allows 5 requests per 15 minutes, email signup allows 5 per hour, and Google sign-in initialization allows 20 per minute. Session reads and JWT issuance allow 60 per minute, while sign-out allows 20 per minute. Redis shares these counters between application instances. Verification email delivery is also limited to three requests per 15 minutes for both the source IP and a keyed hash of the normalized email address.

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
| `POST`   | `/events/:eventId/reservations`               | Guest or user         | Reserves up to 10 tickets for a published event.                                                                                          |
| `GET`    | `/reservations/:reservationId`                | Access token or owner | Returns one reservation with its tickets and QR codes.                                                                                    |
| `POST`   | `/reservations/:reservationId/claim`          | User                  | Saves a guest reservation to the caller's account.                                                                                        |
| `GET`    | `/me/reservations`                            | Authenticated         | Lists the caller's reservations.                                                                                                          |
| `GET`    | `/me/tickets`                                 | Authenticated         | Lists the caller's tickets.                                                                                                               |
| `GET`    | `/me/tickets/:ticketId`                       | Ticket owner          | Returns one ticket.                                                                                                                       |
| `GET`    | `/me/tickets/:ticketId/qr`                    | Ticket owner          | Returns the stored QR data URL and signed payload.                                                                                        |
| `POST`   | `/events/:eventId/check-ins`                  | Owner or admin        | Validates a signed QR payload and consumes the ticket once.                                                                               |
| `GET`    | `/events/:eventId/check-ins`                  | Owner or admin        | Lists event check-ins.                                                                                                                    |

Reservation requests require an `Idempotency-Key` header and a JSON body:

```json
{
  "items": [{ "ticketTypeId": "uuid", "quantity": 2 }],
  "buyer": { "email": "ada@example.com", "name": "Ada Lovelace" }
}
```

`items` lists each ticket type once. A reservation holds at most 10 tickets in total. Guests must send `buyer`. Signed-in users reserve under their account name and email, and the API ignores `buyer` for them. Admin accounts cannot reserve.

The first successful request returns `201`; replaying the same buyer email, key, event, and items returns the original reservation with `200` and does not increment inventory. Reusing the key for a different request returns `409`. Asking for more tickets than a ticket type has left returns `409 NOT_ENOUGH_TICKETS`, and nothing is reserved.

Every reservation response carries an `accessToken`. A guest opens their reservation with `GET /reservations/:reservationId?token=<accessToken>`. The token is an HMAC of the reservation ID under `TICKET_QR_SECRET`, so rotating that secret invalidates emailed links and printed QR codes together. Each ticket email links to `<first FRONTEND_ORIGINS entry>/reservations/:reservationId?token=...`, so list the public site origin first.

A signed-in user sees reservations made under their account. Once their email is verified, they also see guest reservations made with that email.

A guest who signs in later can save a reservation to their account with `POST /reservations/:reservationId/claim` and a `{ "token": "<accessToken>" }` body. The tickets then show under `/me/tickets` whatever email the account uses, and the emailed link keeps working. A reservation that already has an owner returns `409 RESERVATION_ALREADY_CLAIMED` to anyone else.

Checkout has its own per-IP limit, `RESERVATION_RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS`, because guests can reach it without an account.

Ventra generates and stores the QR before the reservation transaction. That work remains synchronous. The same transaction creates the reservation, its `READY` tickets, and one ticket-email outbox record per ticket. The API returns once PostgreSQL commits, so a Redis or Resend outage does not invalidate the reservation.

The worker leases pending outbox rows and publishes `{ ticketId }` jobs to `ventra-ticket-email`. It retries publication after Redis failures and uses a stable `ticket-email-<ticket-id>` BullMQ job ID. The ticket processor loads the QR and buyer details from PostgreSQL, sends the email through Resend, and records `Ticket.emailSentAt`. Replays repair a missing unsent outbox record without creating another reservation.

Ticket jobs make five attempts with exponential backoff beginning at five seconds. Completed jobs stay for 24 hours with a 1,000-job limit. Failed jobs stay for seven days with a 5,000-job limit. OTP jobs make three attempts one second apart, then BullMQ removes them. OTP failures and ticket final failures get sanitized Sentry reports.

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

- `TicketType.reservedCount` grows by the requested quantity only when the result stays within `capacity`. A reservation that spans ticket types takes all of them or none.
- `(buyerEmail, idempotencyKey)` is unique for reservations.
- `Reservation.userId` is null for guest reservations. `buyerEmail` and `buyerName` are always set.
- Ticket public IDs are unique.
- Ticket status changes from `READY` to `USED` through a conditional update.
- `CheckIn.ticketId` is unique as a second exactly-once safeguard.
- Generated PNG QR data URLs are stored durably in `Ticket.qrCodeDataUrl`.
- Successful ticket-email delivery is recorded in `Ticket.emailSentAt` and is not exposed in API responses.

## Organizer storefront backend

All paths below start with `/api/v1`. Responses use the existing `data` envelope.

| Method and path                                     | Access and behavior                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /events/by-slug/:slug`                         | Public for published events. Drafts and cancelled events require the owner or an admin. Returns `data.event` with the same event fields as ID lookup.                                                                                                                |
| `POST /events` and `PATCH /events/:eventId`         | Accept optional `slug`. Lowercase letters, digits, and single hyphens, at most 100 characters. Custom duplicates return `409 EVENT_SLUG_EXISTS`. Generated duplicates receive a random suffix. Title edits leave the slug unchanged. Edits remain limited to drafts. |
| `GET /events/:eventId/sales`                        | Owner/admin only. Returns `data.summary` with event status, currency, reservation count, ticket count, reserved value, and breakdown by ticket type. Decimal amounts are strings with two decimal places.                                                            |
| `GET /events/:eventId/attendees?page=1&pageSize=20` | Owner/admin only. Returns `data.items`, `total`, `page`, and `pageSize`. Maximum page size is 100. One row per ticket includes buyer details, ticket type, reservation status, and check-in time.                                                                    |
| `GET /events/:eventId/attendees.csv`                | Owner/admin only. Streams CSV in batches of 500 tickets. Cells escape quotes, newlines, and spreadsheet formula prefixes. Access tokens and QR data are excluded.                                                                                                    |
| `POST /reservations/recover`                        | Body `{ "email": "buyer@example.com" }`. Returns the same `202` message for every valid address. No lookup results appear in the response. The worker emails links only to the submitted address.                                                                    |

Reports describe reservations, not collected money. There is no payment gateway. Cancelled reservations and void tickets do not contribute to reserved value. Attendee lists include their statuses. Cancelled event reports expose the event status so callers can label them correctly. New tickets capture their unit price at reservation time. The slug backfill includes a corrective migration for titles truncated at a hyphen. The migration backfills older tickets from their current ticket type price because historical prices were not stored.

Recovery allows five requests per IP per 15 minutes and three messages per email per 15 minutes. Redis stores an HMAC of the email for throttling. Excess requests for the same email receive the normal `202` response without another email job. The worker sends up to 50 reservation links per email and continues in another email if needed. Queue failures return an error rather than claiming delivery was scheduled.

### Password reset

Better Auth owns reset tokens and their validation. `POST /api/v1/auth/request-password-reset` accepts `email` and a `redirectTo` URL on an allowed frontend origin. Its email callback queues an encrypted reset link. Tokens expire after 15 minutes. The link first visits Better Auth, which redirects to the frontend reset page with a token. Submit that token and `newPassword` to `POST /api/v1/auth/reset-password`. A successful reset revokes existing sessions. The frontend reset screens remain separate work.

### Checkout bot protection

Set `TURNSTILE_SECRET_KEY` on the API and configure the widget in the frontend with action `checkout`. Send the widget token as `turnstileToken` in the reservation body. `TURNSTILE_HOSTNAMES` is a comma-separated list of allowed frontend hostnames without protocols or paths. If omitted, the API derives hostnames from `FRONTEND_ORIGINS`.

The API checks the token with Cloudflare before allocating inventory. It verifies success, hostname, and action. Invalid challenges return `400 BOT_VERIFICATION_FAILED`. Provider failures time out after five seconds and return `503 BOT_PROTECTION_UNAVAILABLE`. Production checkout also returns `503` if its secret is missing. Development and test mode bypass verification only when the secret is absent. Each submission needs a fresh challenge token, including retries with an existing reservation idempotency key.

### Migration and worker deployment

Stop the API and all old workers before migrating. Drain old ticket email work before applying `20261115100000_order_confirmation`. The new worker uses `ventra-reservation-email`, replacing `ventra-ticket-email`. Do not run an old worker after migration because outbox aggregate IDs now identify reservations. Auth jobs still use `ventra-auth-email`.

Back up the hosted database and apply migrations with `npx prisma migrate deploy`. Deploy the API and worker from the same revision, configure Turnstile, and coordinate the frontend widget before accepting production checkouts. The migration replaces ticket outbox entries with one entry for each undelivered active reservation. A fully delivered reservation stays delivered. A partially delivered reservation receives one consolidated email containing all its tickets. Older queued jobs are not consumed by the new worker.

Resend confirmation idempotency keys use reservation IDs. Delivery timestamps prevent later completed-job replays. As with the existing Resend integration, a crash after sending but before saving the timestamp relies on the provider's idempotency retention period. No exactly-once email guarantee is claimed beyond that period.

Cloudinary, image uploads, payment gateways, fees, payouts, refunds, and frontend pages are outside these changes. Organizers can still provide an HTTPS cover image URL. Slug lookup provides event metadata for the frontend's share-preview handler.
