# Ventra Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Ventra's responsive public, attendee, organizer, and administrator web application on top of the existing ticketing API, including secure browser sessions, global event discovery, offline viewed tickets, and camera/manual check-in.

**Architecture:** Keep the existing Express/Prisma API as the source of truth and add a React 19 + Vite application in `web/`. Production is same-origin: Express serves `web/dist` after API and health routes; development uses Vite's proxy. Access tokens live only in memory, refresh tokens rotate in an HttpOnly cookie, remote data lives in TanStack Query, and only deliberately viewed ticket records are persisted in IndexedDB.

**Tech Stack:** Node.js 24+, TypeScript, Express 5, Prisma 7/PostgreSQL, React 19, Vite, React Router, TanStack Query, React Hook Form, Zod 4, Tailwind CSS, Radix UI primitives, Lucide React, `@zxing/browser`, `vite-plugin-pwa`, `idb`, Vitest, React Testing Library, MSW, axe, and Playwright.

## Global Constraints

- Follow `PRODUCT.md` and `docs/superpowers/specs/2026-08-15-ventra-frontend-design.md` as the authoritative product and interaction specification.
- Do not preserve the old refresh-token-in-JSON browser contract; migrate all auth clients and tests to the cookie contract in the same task.
- Use only static signed QR payloads and exactly-once backend check-in; do not add rotating QR codes.
- Store event instants as UTC while preserving required IANA `timezone`, ISO 4217 `currency`, ISO 3166-1 alpha-2 `countryCode`, and display `city`.
- Event categories are exactly `MUSIC`, `BUSINESS`, `TECHNOLOGY`, `ARTS_CULTURE`, `FOOD_DRINK`, `SPORTS_FITNESS`, `COMMUNITY`, `EDUCATION`, and `OTHER`.
- Payments, refunds, seat maps, messaging, social features, native apps, uploaded cover storage, and analytics dashboards are out of scope.
- Target WCAG 2.2 AA, keyboard operation, visible focus, reduced motion, and touch targets of at least 44 by 44 CSS pixels.
- Update `README.md` whenever architecture, scripts, environment variables, or API contracts change.
- Use test-driven development: record the expected failure before production implementation, then run the narrow test green before continuing.
- Do not use Docker for PostgreSQL. Use the existing local Prisma development database and the separate configured test database.

---

## File and Responsibility Map

### Backend

- `prisma/schema.prisma` and a new migration: global event fields, `EventCategory`, and discovery indexes.
- `src/modules/ticketing/ticketing.schema.ts`: event inputs and public discovery query validation.
- `src/modules/ticketing/ticketing.service.ts`: role-aware discovery, event summaries, and global event persistence.
- `src/modules/ticketing/ticketing.routes.ts`: paginated event contract and unchanged ticketing endpoints.
- `src/modules/auth/auth.routes.ts`: issue, rotate, revoke, and clear refresh cookies.
- `src/modules/auth/auth.schema.ts` and `src/config/env.ts`: remove refresh bodies; define cookie configuration.
- `src/modules/users/users.repository.ts`, `users.service.ts`, and `users.routes.ts`: admin-only paginated user search.
- `src/app.ts`: cookie parsing and production SPA delivery after API routes.
- `tests/integration/*.test.ts`: backend contracts and production fallback behavior.

### Frontend foundation

- `web/src/api/`: response types, fetch client, memory access token, single-flight refresh, and endpoint functions.
- `web/src/auth/`: session provider, route guards, login/register forms, and return-path handling.
- `web/src/app/`: router, query client, shell, navigation, error boundaries, and route-level fallbacks.
- `web/src/components/`: accessible reusable controls, feedback, empty states, and category cover fallback.
- `web/src/lib/`: formatting, event-local date conversion, idempotency intent, and IndexedDB helpers.
- `web/src/features/discovery/`: event search/filter/list/detail/reservation.
- `web/src/features/tickets/`: ticket lists, detail, QR presentation, and offline records.
- `web/src/features/organizer/`: owned event list, event editor, ticket types, publish/cancel, and summaries.
- `web/src/features/check-in/`: camera/manual scanner and live history.
- `web/src/features/admin/`: user search/filter and safe role changes.
- `web/tests/` and `e2e/`: frontend integration, accessibility, and browser acceptance tests.

---

### Task 1: Global event data and public discovery API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260815180000_add_global_event_discovery/migration.sql`
- Modify: `src/modules/ticketing/ticketing.schema.ts`
- Modify: `src/modules/ticketing/ticketing.service.ts`
- Modify: `src/modules/ticketing/ticketing.routes.ts`
- Modify: `tests/integration/ticketing.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces `EventCategory` and event fields `category`, `coverImageUrl`, `city`, `countryCode`, `currency`, and `timezone`.
- Produces `GET /api/v1/events?query&category&from&to&countryCode&page&pageSize` returning `{ data: { items, page, pageSize, total } }`.
- Event create/update accepts ISO UTC instants plus the global fields; ticket prices inherit the event currency by reference.

- [ ] **Step 1: Write failing backend tests**

Add cases that create a global event, reject `http://` cover URLs, invalid IANA zones/currency/country codes, and invalid date order. Add public discovery cases for query, category, date, country, pagination, published/upcoming visibility, and organizer-owned draft visibility. Assert `pageSize` defaults to 20 and is bounded from 1 through 100.

```ts
const response = await request(app).get('/api/v1/events').query({
  query: 'lagos',
  category: 'MUSIC',
  countryCode: 'NG',
  page: 1,
  pageSize: 12,
});

expect(response.status).toBe(200);
expect(response.body.data).toMatchObject({ page: 1, pageSize: 12, total: 1 });
expect(response.body.data.items[0]).toMatchObject({
  category: 'MUSIC',
  city: 'Lagos',
  countryCode: 'NG',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run: `npm run test:integration -- tests/integration/ticketing.test.ts`

Expected: FAIL because the schema fields and paginated `items` response do not exist.

- [ ] **Step 3: Add the Prisma model and migration**

```prisma
enum EventCategory {
  MUSIC
  BUSINESS
  TECHNOLOGY
  ARTS_CULTURE
  FOOD_DRINK
  SPORTS_FITNESS
  COMMUNITY
  EDUCATION
  OTHER
}

model Event {
  category      EventCategory
  coverImageUrl String?
  city          String
  countryCode   String        @db.Char(2)
  currency      String        @db.Char(3)
  timezone      String

  @@index([status, category, startsAt])
  @@index([status, countryCode, startsAt])
}
```

The migration must add non-null columns with explicit safe values for existing development rows (`OTHER`, `Unknown`, `US`, `USD`, `UTC`), then drop SQL defaults so application validation remains authoritative.

- [ ] **Step 4: Implement validation and discovery**

Export these schemas and inferred types from `ticketing.schema.ts`:

```ts
export const eventCategorySchema = z.enum([
  'MUSIC', 'BUSINESS', 'TECHNOLOGY', 'ARTS_CULTURE', 'FOOD_DRINK',
  'SPORTS_FITNESS', 'COMMUNITY', 'EDUCATION', 'OTHER',
]);

export const discoveryQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  category: eventCategorySchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

Validate timezone using `Intl.DateTimeFormat(undefined, { timeZone: value })`, currency using `Intl.NumberFormat(undefined, { style: 'currency', currency: value })`, country format as two uppercase ASCII letters, and cover URLs with `z.url().refine(url => url.protocol === 'https:')`. Use one Prisma `where` object for count and page fetch; search title, venue, city, and `organizer.name` with case-insensitive `contains`.

- [ ] **Step 5: Generate Prisma client, apply migration, and verify**

Run:

```powershell
npm run prisma:generate
npm run prisma:migrate:test
npm run test:integration -- tests/integration/ticketing.test.ts
npm run typecheck
```

Expected: migration applies and focused tests/typecheck pass.

- [ ] **Step 6: Document and commit**

Update event request/response and discovery query examples in `README.md`.

```powershell
git add prisma src/modules/ticketing tests/integration/ticketing.test.ts README.md
git commit -m "feat: add global event discovery"
```

---

### Task 2: Browser-safe auth cookies and admin user search

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/config/env.ts`
- Modify: `src/app.ts`
- Modify: `src/modules/auth/auth.schema.ts`
- Modify: `src/modules/auth/auth.routes.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/users/users.repository.ts`
- Modify: `src/modules/users/users.service.ts`
- Modify: `src/modules/users/users.routes.ts`
- Modify: `tests/integration/auth.test.ts`
- Create: `tests/integration/users.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces `POST /api/v1/auth/register|login` JSON `{ data: { accessToken, user } }` plus refresh cookie.
- Produces `POST /api/v1/auth/refresh` with no JSON body and rotated refresh cookie.
- Produces `POST /api/v1/auth/logout` with no JSON body, revoked session, cleared cookie, and status 204.
- Produces admin-only `GET /api/v1/users?query&role&page&pageSize` returning public user records and pagination.

- [ ] **Step 1: Write failing cookie and user-list tests**

Assert `Set-Cookie` contains `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, `Max-Age=2592000`, and `Secure` only when production is configured. Assert refresh accepts the cookie, rotates its value, rejects missing/invalid cookies, and old rotated cookies cannot be reused. Assert logout clears with matching attributes. Assert public auth JSON never contains `refreshToken` or `passwordHash`.

For `/users`, cover case-insensitive email/name query, optional `USER|ORGANIZER|ADMIN` filtering, pagination, public field selection, non-admin 403, and rejection of attempts to assign `ADMIN` through the existing role endpoint.

- [ ] **Step 2: Run focused tests and record RED**

Run: `npm run test:integration -- tests/integration/auth.test.ts tests/integration/users.test.ts`

Expected: FAIL because refresh still reads JSON and user listing is absent.

- [ ] **Step 3: Add cookie parsing and a single cookie policy**

Install `cookie-parser` and its types. Export one configuration function used for both setting and clearing:

```ts
export const refreshCookieName = 'ventra_refresh';

export function refreshCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}
```

Register `cookieParser()` before routes. Do not configure cross-origin credentials because production is same-origin and Vite development uses a proxy.

- [ ] **Step 4: Migrate all auth routes to cookies**

Keep the service return value internal, destructure it in register/login/refresh routes, set the refresh cookie, and return only access token and public user. Refresh and logout read `request.cookies[refreshCookieName]`. Clear the cookie with the same `httpOnly`, `sameSite`, `secure`, and `path` values after revocation.

- [ ] **Step 5: Implement paginated admin user search**

Use this public shape everywhere:

```ts
export type PublicUser = {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  role: 'USER' | 'ORGANIZER' | 'ADMIN';
  createdAt: Date;
};
```

Validate `page`/`pageSize` like event discovery, build a shared Prisma filter for `count` and `findMany`, sort newest first with `id` as a stable secondary key, and select only public fields.

- [ ] **Step 6: Verify, document, and commit**

Run:

```powershell
npm run test:integration -- tests/integration/auth.test.ts tests/integration/users.test.ts
npm run typecheck
npm run build
```

Update `README.md` with cookie behavior and the user-list endpoint.

```powershell
git add package.json package-lock.json src tests/integration README.md
git commit -m "feat: secure browser sessions and user search"
```

---

### Task 3: React workspace, design system, API client, and session bootstrap

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/index.css`
- Create: `web/src/app/App.tsx`, `web/src/app/router.tsx`, `web/src/app/query-client.ts`
- Create: `web/src/api/types.ts`, `web/src/api/token-store.ts`, `web/src/api/client.ts`, `web/src/api/auth.ts`
- Create: `web/src/auth/SessionProvider.tsx`, `web/src/auth/guards.tsx`
- Create: `web/src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Dialog.tsx`, `Feedback.tsx`
- Create: `web/src/components/layout/AppShell.tsx`, `PublicHeader.tsx`, `MobileNav.tsx`
- Create: `web/src/test/setup.ts`, `web/src/test/server.ts`, `web/src/auth/SessionProvider.test.tsx`
- Create: `web/src/app/router.test.tsx`

**Interfaces:**
- Produces `apiRequest<T>(path, options): Promise<T>` with one single-flight refresh retry after a 401.
- Produces `useSession(): { status, user, login, register, logout }` where access tokens remain in module memory only.
- Produces `RequireUser`, `RequireRole`, and `AnonymousOnly` route boundaries preserving a same-origin return path.

- [ ] **Step 1: Scaffold the workspace and install established dependencies**

Create `web/` with React TypeScript Vite. Add React Router, TanStack Query, React Hook Form, Zod resolver, Tailwind, Radix Dialog/Select, Lucide, `@zxing/browser`, `vite-plugin-pwa`, and `idb`. Add Vitest, jsdom, Testing Library, user-event, MSW, `vitest-axe`, and Playwright as development dependencies. Use npm workspaces at the root:

```json
{
  "workspaces": ["web"],
  "scripts": {
    "dev:web": "npm run dev --workspace web",
    "build:web": "npm run build --workspace web",
    "test:web": "npm run test --workspace web",
    "test:e2e": "playwright test"
  }
}
```

Configure Vite to proxy `/api` and `/health` to `http://localhost:3000`.

- [ ] **Step 2: Write failing session and guard tests**

Use MSW to cover successful refresh bootstrap, missing cookie returning anonymous, two simultaneous 401s causing exactly one refresh request, retrying each original request once, failed refresh clearing the in-memory token, logout, role denial, and `/login?returnTo=%2Ftickets` restoration. Verify unsafe external `returnTo` values resolve to `/`.

- [ ] **Step 3: Run focused frontend tests and record RED**

Run: `npm run test:web -- SessionProvider.test.tsx router.test.tsx`

Expected: FAIL because session modules and guards do not exist.

- [ ] **Step 4: Implement the API client and single-flight refresh**

```ts
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(value: string | null): void {
  accessToken = value;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init, accessToken);
  if (response.status !== 401 || path.endsWith('/auth/refresh')) return unwrap<T>(response);
  refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null; });
  const renewed = await refreshPromise;
  if (!renewed) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in');
  return unwrap<T>(await send(path, init, renewed));
}
```

Every request uses `credentials: 'same-origin'`. Never write either token to localStorage, sessionStorage, IndexedDB, URL state, or logs.

- [ ] **Step 5: Build the session provider, routes, and visual foundation**

Bootstrap once by calling refresh, store the access token in memory, keep the public user in provider state, and clear QueryClient on logout. Route guards must render a neutral full-page loading state during bootstrap, redirect anonymous users to login with the internal return path, and route forbidden roles to `/`.

Implement the approved foundation: near-white canvas, graphite type, electric-indigo action color, moderate radii, crisp borders, fixed-aspect event imagery, visible focus rings, reduced-motion media query, desktop public header, and attendee-oriented compact mobile navigation. Use CSS variables as Tailwind theme tokens rather than hardcoded per-component colors.

- [ ] **Step 6: Verify accessibility and commit**

Run:

```powershell
npm run test:web -- SessionProvider.test.tsx router.test.tsx
npm run build:web
npm run typecheck
```

```powershell
git add package.json package-lock.json web
git commit -m "feat: establish Ventra web application"
```

---

### Task 4: Public discovery, event detail, authentication, and reservation

**Files:**
- Create: `web/src/features/discovery/event-api.ts`, `event-types.ts`, `filters.ts`
- Create: `web/src/features/discovery/DiscoveryPage.tsx`, `EventCard.tsx`, `EventCover.tsx`
- Create: `web/src/features/discovery/EventDetailPage.tsx`, `ReservationPanel.tsx`
- Create: `web/src/auth/LoginPage.tsx`, `RegisterPage.tsx`, `auth-schema.ts`
- Create: `web/src/lib/date-time.ts`, `currency.ts`, `reservation-intent.ts`
- Create: `web/src/features/discovery/DiscoveryPage.test.tsx`
- Create: `web/src/features/discovery/EventDetailPage.test.tsx`
- Create: `web/src/auth/AuthPages.test.tsx`

**Interfaces:**
- Consumes the paginated event API and cookie session from Tasks 1 through 3.
- Produces URL-owned discovery filters and one stable `Idempotency-Key` for each reservation intent.

- [ ] **Step 1: Write failing discovery, auth, and reservation tests**

Cover filter initialization from URL, debounced query replacement, category/date/country request mapping, pagination, loading/empty/error/retry views, category fallback cover, event-local time, currency display, sold-out state, anonymous login return, form errors, reservation success navigation, and reused idempotency key across network retry. Assert changing the event or ticket type creates a new key.

- [ ] **Step 2: Run focused tests and record RED**

Run: `npm run test:web -- DiscoveryPage.test.tsx EventDetailPage.test.tsx AuthPages.test.tsx`

Expected: FAIL because the public feature modules do not exist.

- [ ] **Step 3: Implement URL-owned discovery and event cards**

Define the URL contract as `q`, `category`, `from`, `to`, `country`, and `page`. Normalize empty/default values out of the URL, reset page to 1 when a filter changes, and use `placeholderData` to keep the previous page visible during pagination. Cards show cover/fallback, category, title, event-local date, city/country, and lowest available price; images use `loading="lazy"`, `referrerPolicy="no-referrer"`, an aspect ratio, and fallback on error.

- [ ] **Step 4: Implement event detail, auth forms, and reservation intent**

```ts
export type ReservationIntent = {
  eventId: string;
  ticketTypeId: string;
  key: string;
};

export function getReservationKey(
  current: ReservationIntent | null,
  eventId: string,
  ticketTypeId: string,
): ReservationIntent {
  if (current?.eventId === eventId && current.ticketTypeId === ticketTypeId) return current;
  return { eventId, ticketTypeId, key: crypto.randomUUID() };
}
```

Render primary dates using `Intl.DateTimeFormat` with the event timezone and optionally show viewer-local time as secondary copy. Format price using the event currency. Keep the mobile reservation action sticky without obscuring content. Login/register use RHF plus shared Zod rules, preserve values after failures, and only honor return paths that start with a single `/` and not `//`.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run test:web -- DiscoveryPage.test.tsx EventDetailPage.test.tsx AuthPages.test.tsx
npm run build:web
```

```powershell
git add web/src/features/discovery web/src/auth web/src/lib
git commit -m "feat: add event discovery and reservation flow"
```

---

### Task 5: Attendee tickets, reservations, and deliberate offline access

**Files:**
- Modify: `web/vite.config.ts`
- Create: `web/src/features/tickets/ticket-api.ts`, `ticket-types.ts`
- Create: `web/src/features/tickets/TicketsPage.tsx`, `TicketDetailPage.tsx`, `ReservationsPage.tsx`
- Create: `web/src/features/tickets/TicketQr.tsx`, `OfflineBadge.tsx`
- Create: `web/src/lib/offline-tickets.ts`
- Modify: `web/src/auth/SessionProvider.tsx`
- Create: `web/src/features/tickets/TicketDetailPage.test.tsx`
- Create: `web/src/lib/offline-tickets.test.ts`

**Interfaces:**
- Produces `OfflineTicketRecord` keyed by `[userId, ticketId]` and purge-by-user behavior.
- The PWA caches the app shell/static assets only; authenticated HTTP API responses remain network-only.

- [ ] **Step 1: Write failing offline ticket tests**

Cover storing a ticket only after its detail and QR both load, reading it when the network is unavailable, isolation by user ID, updating status from a later online response, purging the signed payload on logout, and refusing records whose `userId` differs from the active session. Verify screen copy identifies offline/stale state and never claims live validity.

- [ ] **Step 2: Run focused tests and record RED**

Run: `npm run test:web -- TicketDetailPage.test.tsx offline-tickets.test.ts`

Expected: FAIL because no IndexedDB ticket store exists.

- [ ] **Step 3: Implement the minimum offline record**

```ts
export type OfflineTicketRecord = {
  userId: string;
  ticketId: string;
  publicId: string;
  status: 'PENDING' | 'READY' | 'USED' | 'VOID';
  qrPayload: string;
  qrCodeDataUrl: string;
  eventTitle: string;
  ticketTypeName: string;
  startsAt: string;
  timezone: string;
  venue: string;
  city: string;
  countryCode: string;
  cachedAt: string;
};
```

Use `idb` with database `ventra`, store `tickets`, compound key `['userId', 'ticketId']`, and index `by-user`. Export `putOfflineTicket`, `getOfflineTicket`, `listOfflineTickets`, and `deleteOfflineTicketsForUser`. Session logout must await the purge before completing its user-visible transition.

- [ ] **Step 4: Implement ticket/reservation screens and PWA policy**

Group tickets and reservations into current/past using event-local dates. Ticket detail renders the backend-provided QR data URL at a large fixed size with quiet space, supports a high-brightness full-screen dialog, exposes the signed payload for manual fallback, and labels offline records with their cache time. Use Web Share when available and fall back to downloading the QR PNG; neither path may put the signed payload in an external URL. Wire `SessionProvider.logout` to await `deleteOfflineTicketsForUser(activeUser.id)` before dropping the active user. Configure `vite-plugin-pwa` with app-shell precaching and `NetworkOnly` for `/api/**`; do not add runtime caching for authenticated JSON.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run test:web -- TicketDetailPage.test.tsx offline-tickets.test.ts
npm run build:web
```

```powershell
git add web/vite.config.ts web/src/features/tickets web/src/lib/offline-tickets*
git commit -m "feat: add attendee tickets with offline access"
```

---

### Task 6: Organizer event and ticket-type operations

**Files:**
- Create: `web/src/features/organizer/organizer-api.ts`, `organizer-types.ts`
- Create: `web/src/features/organizer/OrganizerEventsPage.tsx`
- Create: `web/src/features/organizer/EventEditorPage.tsx`, `event-editor-schema.ts`
- Create: `web/src/features/organizer/TicketTypeEditor.tsx`
- Create: `web/src/features/organizer/OrganizerEventPage.tsx`, `UnsavedChangesGuard.tsx`
- Create: `web/src/lib/zoned-date-time.ts`
- Create: `web/src/features/organizer/EventEditorPage.test.tsx`
- Create: `web/src/features/organizer/OrganizerEventPage.test.tsx`

**Interfaces:**
- Consumes organizer event CRUD, ticket-type CRUD, publish/cancel, and check-in list endpoints.
- Produces `toUtcInstant(localDateTime, timeZone): string` with DST gap/ambiguity validation.

- [ ] **Step 1: Write failing organizer tests**

Cover draft/published/cancelled grouping, organizer-only guards, local event time converted to a UTC instant, invalid IANA zone, DST-skipped local time rejection, field errors, HTTPS cover validation, shared currency display, ticket capacity constraints, publish/cancel confirmation, draft-only editing, and unsaved-change navigation protection.

- [ ] **Step 2: Run focused tests and record RED**

Run: `npm run test:web -- EventEditorPage.test.tsx OrganizerEventPage.test.tsx`

Expected: FAIL because organizer modules do not exist.

- [ ] **Step 3: Implement strict event-local conversion and form schemas**

Use the platform `Temporal` API only if available in the project's Node/browser targets; otherwise add the maintained `@js-temporal/polyfill` package and use `Temporal.ZonedDateTime.from`. Require an explicit timezone before converting local inputs, reject nonexistent/ambiguous wall times with a linked form error, and submit UTC ISO strings. Keep currency at event level and never duplicate it on ticket-type forms.

- [ ] **Step 4: Build organizer pages in working layers**

First deliver owned-event lists and empty states. Then deliver creation with event basics/global fields, save the draft, and add ticket types against the returned event ID. Finally add overview counts, edit, publish, cancel, and check-in entry. Disable destructive/conflicting mutations while one is pending and invalidate only the affected event/list queries.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run test:web -- EventEditorPage.test.tsx OrganizerEventPage.test.tsx
npm run build:web
```

```powershell
git add package.json package-lock.json web/src/features/organizer web/src/lib/zoned-date-time.ts
git commit -m "feat: add organizer event operations"
```

---

### Task 7: Camera/manual check-in and administrator user management

**Files:**
- Create: `web/src/features/check-in/check-in-api.ts`, `scanner-state.ts`
- Create: `web/src/features/check-in/CheckInPage.tsx`, `CameraScanner.tsx`, `ManualCheckIn.tsx`, `CheckInResult.tsx`
- Create: `web/src/features/check-in/CheckInPage.test.tsx`
- Create: `web/src/features/admin/admin-api.ts`, `AdminUsersPage.tsx`, `RoleDialog.tsx`
- Create: `web/src/features/admin/AdminUsersPage.test.tsx`

**Interfaces:**
- Scanner state is exactly `idle | requesting | scanning | validating | success | already-used | wrong-event | invalid | permission-denied | offline`.
- Admin UI permits only `USER` and `ORGANIZER` assignment and treats backend 403 as authoritative.

- [ ] **Step 1: Write failing scanner and admin tests**

Mock `@zxing/browser` and media permissions. Cover explicit camera start, permission denial, stop on unmount, pause while validating, duplicate payload suppression, resume action, manual payload submission, online/offline state, recent check-in history, ARIA live announcements, and mappings for success, `TICKET_ALREADY_USED`, `TICKET_EVENT_MISMATCH`, and invalid payload responses. For admin, cover query/role/page URL state, result rendering, confirmation, successful invalidation, forbidden response, and absence of an ADMIN assignment choice.

- [ ] **Step 2: Run focused tests and record RED**

Run: `npm run test:web -- CheckInPage.test.tsx AdminUsersPage.test.tsx`

Expected: FAIL because scanner and admin modules do not exist.

- [ ] **Step 3: Implement the scanner state machine**

```ts
export type ScannerState =
  | { kind: 'idle' | 'requesting' | 'scanning' | 'permission-denied' | 'offline' }
  | { kind: 'validating'; payload: string }
  | { kind: 'success'; attendeeName: string; checkedInAt: string }
  | { kind: 'already-used'; checkedInAt?: string }
  | { kind: 'wrong-event' | 'invalid' };
```

Create the ZXing controls only after the user presses Start camera. Stop media tracks on route exit. On decode, immediately pause scanning, ignore the same payload until the current mutation settles, submit once, announce the result, prepend successful results to the event's recent check-in history, and require an explicit Scan next ticket action before resuming. Keep manual entry available in every non-validating state.

- [ ] **Step 4: Implement admin user management**

Keep `q`, `role`, and `page` in the URL. Display name, email, current role, and creation date. Open a focus-trapped confirmation dialog for USER/ORGANIZER changes, disable repeat submission, update the row after success, and show a durable inline error after failure.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run test:web -- CheckInPage.test.tsx AdminUsersPage.test.tsx
npm run build:web
```

```powershell
git add web/src/features/check-in web/src/features/admin
git commit -m "feat: add check-in and admin workflows"
```

---

### Task 8: Same-origin production delivery and complete acceptance suite

**Files:**
- Modify: `src/app.ts`
- Modify: `src/server.ts`
- Modify: `package.json`
- Modify: `tests/integration/health.test.ts`
- Create: `tests/integration/spa.test.ts`
- Create: `playwright.config.ts`
- Create: `e2e/attendee.spec.ts`, `organizer.spec.ts`, `admin.spec.ts`, `production-routing.spec.ts`
- Modify: `README.md`
- Create: `DESIGN.md`

**Interfaces:**
- Root `npm run build` builds server and web; `npm start` serves API, health, static assets, and browser routes from one origin.
- `/api/**` and `/health` always return API/health responses or API 404s and never `index.html`.

- [ ] **Step 1: Write failing production routing tests**

Create a temporary web distribution fixture and assert `/events/<uuid>` returns the SPA HTML while `/api/v1/unknown` returns JSON 404, `/health` remains JSON, static files get appropriate immutable caching when hashed, and missing static assets do not incorrectly return HTML.

- [ ] **Step 2: Run the routing test and record RED**

Run: `npm run test:integration -- tests/integration/spa.test.ts`

Expected: FAIL because Express does not serve the SPA.

- [ ] **Step 3: Implement same-origin production delivery**

Build API/health middleware first, then `express.static(webDist, { index: false, immutable: true, maxAge: '1y' })` for hashed assets, then a browser-route fallback that accepts GET HTML navigation requests only. Return the existing JSON not-found envelope for `/api` paths before the SPA fallback. Root scripts must build the Vite application before TypeScript server output and start only the compiled server.

- [ ] **Step 4: Add Playwright acceptance coverage**

Use deterministic API/database setup and test these complete flows:

1. Register, discover/filter, reserve, open ticket, reload that viewed ticket offline.
2. Organizer creates a globally located event and ticket types, publishes, and checks in a ticket using manual payload entry.
3. Admin searches for a user and promotes the account to organizer.
4. Desktop and mobile route smoke, keyboard navigation, direct-route production refresh, and same-origin API requests.

Run Chromium projects at 1440 by 900 and a representative 390 by 844 mobile viewport. Do not make the test depend on a physical camera.

- [ ] **Step 5: Run Impeccable finish checks and record the design system**

Invoke Impeccable `detector`, `reviewer`, and `documenter`. Fix critical accessibility/interaction findings, verify responsive breakpoints visually in the browser, and generate `DESIGN.md` from the final implemented tokens/components. The design document must record typography, color tokens, radii, spacing, imagery behavior, event cards, navigation, feedback states, and scanner contrast rules.

- [ ] **Step 6: Run the single final verification gate**

Ensure the local no-Docker test database is running once, then run:

```powershell
npm run prisma:migrate:test
npm test
npm run test:web
npm run test:e2e
npm run typecheck
npm run build
npm run format:check
git diff --check
```

Expected: all tests, type checks, builds, formatting, and whitespace checks pass.

- [ ] **Step 7: Update documentation and commit**

Document prerequisites, no-Docker PostgreSQL setup, root/web development commands, environment variables, browser session security, global event fields, discovery/admin APIs, PWA limitations, production serving, and acceptance commands in `README.md`.

```powershell
git add src tests package.json package-lock.json playwright.config.ts e2e web README.md DESIGN.md
git commit -m "feat: deliver production Ventra frontend"
```

---

## Completion Gate

- Every route in the approved design exists and enforces its role boundary.
- The public discovery response is paginated and globally filterable.
- Refresh credentials never enter JavaScript-accessible storage or JSON responses.
- A viewed ticket remains displayable offline for its owning user and is purged on logout.
- Camera and manual check-in produce unambiguous accessible outcomes without double submission.
- Express serves the built SPA without masking API or health routes.
- `README.md`, `PRODUCT.md`, `DESIGN.md`, API behavior, and implementation agree.
- The final verification command set passes before push.
