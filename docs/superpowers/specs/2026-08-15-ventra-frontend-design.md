# Ventra Frontend Design

## Goal

Build a production-ready, responsive React frontend for the existing Ventra ticketing API. The same web application serves public visitors, attendees, organizers, and administrators while keeping event discovery as the primary public experience.

## Product Direction

Ventra uses familiar event-marketplace conventions at an Eventbrite and Luma quality bar. The visual system is restrained and content-led: white and near-white surfaces, graphite text, electric indigo as the primary action color, event photography or branded fallbacks, crisp dividers, moderate radii, and a single contemporary workhorse sans family. The experience must feel polished and trustworthy rather than experimental.

The public shell uses top navigation with search, Explore, My Tickets, Create Event, and account controls. Authenticated organizer and admin areas may introduce denser local navigation, but users remain within one coherent product. Mobile uses compact headers and a bottom navigation where it materially improves attendee tasks.

## Frontend Architecture

Create `web/` as a React 19 + Vite TypeScript application. Use:

- React Router for route composition, authenticated loaders, and role guards.
- TanStack Query for server state, mutations, invalidation, retries, and session-aware caching.
- React Hook Form and Zod for forms and client-side validation aligned with backend rules.
- Tailwind CSS with accessible headless primitives for the custom component system; use Lucide for interface icons.
- `@zxing/browser` for camera QR scanning with manual payload fallback.
- `vite-plugin-pwa` for installability and app-shell caching.
- IndexedDB for deliberately cached, previously viewed attendee tickets and QR data.
- Vitest, React Testing Library, MSW, axe checks, and Playwright for verification.

Do not add Redux. Remote API data stays in TanStack Query; short-lived UI state stays local or in narrowly scoped context providers.

## Routes and Experiences

### Public and authentication

- `/` — discovery homepage with query, category, date, and location filters plus paginated event cards.
- `/events/:eventId` — event detail, organizer identity, authoritative event-local time, venue/location, ticket types, availability, and reserve action.
- `/login` and `/register` — focused account flows with return-to-intended-page behavior.

Published events are public. Reserving redirects anonymous visitors to login and returns them to the selected event afterward.

### Attendee

- `/tickets` — current and past tickets.
- `/tickets/:ticketId` — event summary, ticket type, status, large QR, signed payload fallback, offline state, and save/share controls.
- `/reservations` — reservation history.

Opening a ticket stores only that user’s minimum ticket display record and QR data in IndexedDB. Logout removes cached user tickets. The service worker caches the application shell and static assets, not arbitrary authenticated API responses.

### Organizer

- `/organizer/events` — owned events grouped by draft, published, and cancelled state.
- `/organizer/events/new` — event creation wizard: basics, global location/time/currency, cover image URL, then ticket types.
- `/organizer/events/:eventId` — overview, capacity/reservation summaries, ticket types, publish/cancel actions, and check-in entry point.
- `/organizer/events/:eventId/edit` — draft-only event and ticket-type editing.
- `/organizer/events/:eventId/check-in` — camera scanner, manual entry, current counts, recent results, and check-in history.

The scanner requests camera permission only after an explicit action. It pauses while validating a payload, prevents accidental duplicate submissions, and presents unmistakable success, already-used, wrong-event, invalid, permission-denied, and offline states.

### Administrator

- `/admin/users` — paginated user search with role filter and controlled `USER`/`ORGANIZER` role changes.

The interface never offers assignment of `ADMIN`.

## Required Backend Changes

### Secure browser sessions

Change registration, login, and refresh to issue the refresh token in an `HttpOnly`, `SameSite=Lax` cookie. Use `Secure` in production, a 30-day max age, and an auth-scoped path. Return the access token and public user in JSON; keep the access token in browser memory. Refresh reads and rotates the cookie; logout revokes it and clears the cookie. The SPA retries a request once after a successful single-flight refresh, then redirects to login.

### Global event data

Extend `Event` with:

- `category`: `MUSIC`, `BUSINESS`, `TECHNOLOGY`, `ARTS_CULTURE`, `FOOD_DRINK`, `SPORTS_FITNESS`, `COMMUNITY`, `EDUCATION`, or `OTHER`.
- `coverImageUrl`: optional HTTPS URL.
- `city`: required display city.
- `countryCode`: required ISO alpha-2 code.
- `currency`: required ISO 4217 code shared by the event’s ticket types.
- `timezone`: required IANA timezone.

Event date/time inputs are interpreted in the selected event timezone and stored as UTC instants. API responses include the event timezone and currency so clients can render authoritative event-local values. The frontend may show the viewer-local equivalent as secondary text.

### Discovery and administration APIs

- `GET /api/v1/events?query=&category=&from=&to=&countryCode=&page=&pageSize=` returns `{ items, page, pageSize, total }`. Public results include only published upcoming events; organizer/admin visibility continues to respect role and ownership.
- `GET /api/v1/users?query=&role=&page=&pageSize=` is admin-only and returns public user fields with pagination.

Validate bounded page sizes and indexed filters. Search title, venue, city, and organizer name case-insensitively. Add database indexes for public category/date and country/date queries.

### Production integration

Vite development proxies `/api` and `/health` to Express. Production Express serves `web/dist` and returns `index.html` for non-API browser routes. API and health routes must never fall through to the SPA. Root scripts install, develop, build, test, and start both parts predictably.

## Interaction and State Rules

- Show skeletons for initial lists/details, inline progress for mutations, actionable empty states, and retry controls for recoverable failures.
- Map stable backend error codes to specific user messages; unknown errors use a generic message and retain technical details only in development logs.
- Reservation generates one client idempotency key per intent and reuses it across retries until success or the user changes event/ticket type.
- Currency uses the event’s ISO code with `Intl.NumberFormat`; dates use `Intl.DateTimeFormat` with the event timezone.
- Remote cover images use HTTPS, no-referrer behavior, fixed aspect ratios, lazy loading, and a branded category fallback.
- Route guards hide inaccessible navigation and still treat backend `401/403` responses as authoritative.
- Forms preserve input after validation or network failure and warn before abandoning unsaved organizer edits.
- Motion is restrained, honors reduced motion, and never delays check-in feedback.

## Responsive and Accessibility Behavior

- Public discovery scales from a one-column mobile feed to a three/four-column desktop grid.
- Event detail keeps reservation actions reachable through a mobile sticky action bar without obscuring content.
- Ticket QR renders with adequate quiet zone and contrast and supports full-screen brightness presentation.
- Scanner controls are reachable by touch and keyboard, status is announced through an ARIA live region, and meaning never relies on color alone.
- Every modal traps and restores focus; forms have visible labels, linked errors, and logical tab order.
- Meet WCAG 2.2 AA color contrast and minimum target sizes.

## Testing and Acceptance

### Backend

- Cookie issuance, rotation, revocation, expiry, security flags, and missing/invalid-cookie behavior.
- Event category/global fields, timezone validation, currency validation, cover URL validation, search/filter/pagination, and role-aware visibility.
- Admin user search/pagination and forbidden role changes.
- Static SPA delivery without API route masking.

### Frontend unit and integration

- Session bootstrap, single-flight refresh, logout cleanup, guards, and intended-route restoration.
- Discovery filters reflected in the URL and API requests.
- Event creation timezone/currency transformations and field errors.
- Reservation idempotency behavior and success navigation.
- Ticket IndexedDB caching, offline retrieval, and purge on logout.
- Scanner camera permission, manual fallback, duplicate scan suppression, and all check-in results.
- Accessible names, focus behavior, keyboard operation, and critical axe checks.

### End-to-end

- Register/login, discover/filter, reserve, retrieve QR, reload offline ticket.
- Organizer creates event/ticket types, publishes, and checks in a ticket through manual payload entry.
- Admin finds a user and promotes them to organizer.
- Desktop and mobile route smoke tests, direct browser-route refresh, and production same-origin API calls.

## Delivery Boundaries

- No payment processing, refunds, social graph, messaging, seat selection, native mobile application, file-upload storage, dynamic rotating QR, or analytics dashboard.
- Cover images use optional HTTPS URLs with branded fallbacks.
- Static signed QR with exactly-once backend check-in remains the v1 security model.
- Sample UI content must be clearly synthetic; no fabricated customers, testimonials, or commercial claims.
