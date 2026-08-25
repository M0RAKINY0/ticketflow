# Task 3 ticketing MVC refactor implementation plan

## Goal

Move ticketing HTTP translation into named controllers and standalone Prisma operations into a ticketing model without changing routes, responses, authorization, inventory enforcement, idempotency, or check-in behavior.

## Current data and behavior

- `ticketing.routes.ts` owns 17 handlers. Each handler parses the same request data, calls the same service function, and returns the same status and success envelope after this refactor.
- `ticketing.service.ts` owns event visibility and ownership rules, draft checks, ticket-capacity checks, reservation replay rules, QR decoration, and error mapping for Prisma uniqueness conflicts.
- Event listing uses a Prisma array transaction to return matching records and a count from one model operation.
- Event publication uses a callback transaction that checks ownership and draft state, counts ticket types, then updates the event.
- Reservation creation uses a callback transaction with a conditional `TicketType.updateMany`, diagnostic availability reads, and a nested reservation and ticket write. The per-user idempotency lookup happens before the transaction and again after a concurrent uniqueness conflict.
- Check-in uses a callback transaction that reads the ticket, conditionally changes `READY` to `USED`, and creates one check-in. The completed check-in is fetched after the transaction.

## File responsibilities

- `src/modules/ticketing/ticketing.controller.ts` will contain one named Express handler per route plus Zod error translation.
- `src/modules/ticketing/ticketing.routes.ts` will contain paths, shared middleware chains, and named controller references only.
- `src/modules/ticketing/ticketing.model.ts` will export `ticketingModel`. It will own standalone event, ticket type, reservation, ticket, check-in, and event-owner Prisma calls. It will also own the reusable Prisma include objects.
- `src/modules/ticketing/ticketing.service.ts` will retain business rules and all callback transactions. Calls made through a callback transaction client will remain in the service.
- `src/modules/ticketing/ticketing.authorization.ts` will preserve `EventPrincipal` and `canManageEvent` under the feature-qualified filename.
- `tests/unit/controller-boundaries.test.ts` will verify controller response behavior, validation mapping, and every ticketing route's middleware and named handler wiring through runtime behavior.
- `tests/unit/event-ownership.test.ts` will use the renamed authorization module.
- `README.md` will describe the completed ticketing MVC boundary.

## Test-first execution

1. Add runtime route assertions for all 17 ticketing routes and controller behavior checks for validation, reservation status selection, success envelopes, and service-error forwarding.
2. Run `npm test -- tests/unit/controller-boundaries.test.ts` and record the expected RED result against the current inline route handlers.
3. Add `ticketing.controller.ts`, move each existing handler without changing request parsing or response construction, and replace inline route handlers with named controller references.
4. Re-run the controller boundary test and record GREEN.
5. Add `ticketing.model.ts`. Move only standalone Prisma operations into `ticketingModel`; keep publication, reservation, and check-in callback transaction bodies in `ticketing.service.ts`.
6. Rename `authorization.ts`, update imports and tests, and remove the old file without a compatibility export.
7. Update the README architecture section and run the required focused tests, typecheck, formatting check for touched files, and `git diff --check`.
8. Compare the old and new transaction bodies line by line, inspect the complete diff, write the required Task 3 report, then commit with a descriptive subject and body.

## Transaction-preservation checklist

- [x] Publication still checks ownership inside its transaction, rejects non-draft events, requires at least one ticket type, and updates status in the same callback.
- [x] Reservation still performs the same preflight replay lookup before generating ticket data.
- [x] Reservation still increments inventory with one conditional update and checks `count === 1` inside the transaction.
- [x] Reservation availability diagnostics still use the same transaction client and error order.
- [x] Reservation and ticket creation still occur through the same nested transaction write.
- [x] Concurrent idempotency conflicts still trigger the same replay lookup and request-match check.
- [x] Check-in access and QR verification still happen before the transaction in the same order.
- [x] Check-in still conditionally changes one `READY` ticket to `USED` and creates the check-in in the same transaction.
- [x] The post-transaction reservation and check-in fetches preserve their includes and result shapes.

## Verification commands

```powershell
npm test -- tests/unit/controller-boundaries.test.ts tests/unit/event-ownership.test.ts tests/unit/ticketing-schema-runtime.test.ts
npm run typecheck
npx prettier --check README.md docs/task-3-ticketing-mvc-plan.md src/modules/ticketing/ticketing.authorization.ts src/modules/ticketing/ticketing.controller.ts src/modules/ticketing/ticketing.model.ts src/modules/ticketing/ticketing.routes.ts src/modules/ticketing/ticketing.service.ts tests/unit/controller-boundaries.test.ts tests/unit/event-ownership.test.ts
git diff --check
```
