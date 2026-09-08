# Ticket email implementation plan

## Purpose

Send each attendee their generated ticket QR code through Resend immediately after Ventra creates a reservation. This change keeps QR generation synchronous and does not add BullMQ, RabbitMQ, or deployment configuration.

## Data and behavior

- Add `emailSentAt` to `Ticket` so Ventra records successful ticket delivery.
- Build the email from data already stored with the reservation: attendee email, event name and start time, ticket type name, ticket public reference, and QR PNG data.
- Render the QR code inside the HTML email through a CID attachment and include the same PNG as a downloadable attachment.
- Send through the existing Resend API client with `ticket-confirmation/<ticket-id>` as the idempotency key.
- Attempt delivery after the reservation transaction commits. Mark `emailSentAt` only after Resend accepts the message.
- On an idempotent reservation replay, skip delivery when `emailSentAt` exists. If it is empty, retry the same Resend request.
- Preserve the reservation if email delivery fails and return the existing application error envelope.

## Code changes

1. Extend the email transport contract and add a ticket email sender with independently testable message construction.
2. Include the attendee identity in reservation lookups and add model support for marking a ticket email as sent.
3. Call the ticket email sender from reservation creation and replay paths.
4. Add and apply a Prisma migration for `Ticket.emailSentAt`.
5. Document ticket email delivery and its environment requirements in `README.md`.

## Tests

- Unit-test recipient, subject, ticket details, CID image, PNG attachment, Base64 conversion, idempotency key, and provider-error redaction.
- Integration-test successful delivery marking, duplicate suppression on reservation replay, and retry after a failed delivery.
- Run Prisma generation, the focused unit and integration tests, the complete test suite, type checking, build, and formatting checks.
