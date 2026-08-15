# Ventra Lean Ticketing Implementation Plan

## Purpose

Complete the smallest backend that satisfies Ventra's core ticketing flow: organizers create publishable events with capacity-limited ticket types, users reserve tickets, each ticket receives a QR code, and organizers perform one-time check-in.

This plan supersedes the remaining infrastructure-heavy tasks in `docs/superpowers/plans/2026-08-14-ventra-ticketing-backend.md`.

## Included

- Existing JWT authentication and `USER`, `ORGANIZER`, `ADMIN` authorization.
- Organizer-owned event create, update, publish, cancel, list, and detail endpoints.
- Ticket-type create, update, delete, and public listing endpoints.
- Transactional, idempotent reservations that cannot exceed capacity.
- Synchronous QR generation during reservation, stored as a data URL on the ticket record.
- Attendee ticket list/detail endpoints.
- Organizer/admin one-time ticket check-in and event check-in listing.
- Stable validation/error responses and integration tests for the complete flow.

## Excluded

- BullMQ background jobs.
- Redis caching and distributed rate limiting.
- Docker, Nginx, and horizontal scaling configuration.
- Payment processing and a frontend.
- Expanded CI and operational observability beyond the existing server foundation.

## Data Changes

The existing `Event`, `TicketType`, `Reservation`, `Ticket`, and `CheckIn` models remain authoritative. Add `Ticket.qrCodeDataUrl String?` so the generated PNG data URL is stored durably with the ticket. Preserve the existing unique reservation idempotency, opaque ticket `publicId`, ticket/check-in uniqueness, and ticket-type inventory checks.

## API

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
- `POST /api/v1/events/:eventId/reservations`
- `GET /api/v1/me/reservations`
- `GET /api/v1/me/tickets`
- `GET /api/v1/me/tickets/:ticketId`
- `GET /api/v1/me/tickets/:ticketId/qr`
- `POST /api/v1/events/:eventId/check-ins`
- `GET /api/v1/events/:eventId/check-ins`

## Implementation Chunks

1. Add event and ticket-type modules with organizer ownership and publication rules.
2. Add atomic reservation creation using conditional inventory updates and idempotency keys.
3. Generate an opaque signed QR payload and PNG data URL synchronously when the ticket is created.
4. Add attendee ticket retrieval and organizer/admin one-time check-in.
5. Update `README.md` to match the delivered lean architecture and document commands/endpoints.
6. Run Prisma generation/migration, the complete test suite, type-check, build, and Git diff checks once after implementation; fix any failures before commit and push.

## Completion Criteria

- A public user sees only published events.
- An organizer cannot modify another organizer's event.
- An event cannot publish without a ticket type.
- Concurrent reservations never exceed ticket capacity.
- Repeating an idempotency key returns the original reservation without consuming inventory twice.
- QR content contains only a signed opaque ticket identifier.
- Exactly one of two concurrent check-ins succeeds.
- Existing authentication behavior remains green.
