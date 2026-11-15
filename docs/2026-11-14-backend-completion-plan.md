# Backend completion plan

Date: 2026-11-14

## Purpose

Complete the backend portions of the Shopify for events feature list. Keep payment collection, fees, payouts, refunds, receipts, and paid checkout holds outside this task. Keep frontend changes outside this task.

## Findings

The active API checkout is on guest-checkout and has no working changes. It uses Express, Prisma, PostgreSQL, Better Auth, BullMQ, Redis, and Resend. Events have no slug. Ticket email jobs and delivery timestamps belong to individual tickets. Password authentication has no password reset email handler. Checkout has a per-IP limit without Turnstile verification. No image storage provider is configured.

## Proposed implementation

1. Add unique editable event slugs with database backfill, collision handling, public slug lookup, and existing event visibility rules. Retain event IDs for internal ownership and relations. Slug lookup supplies the data needed by frontend link previews.
2. Image uploads and Cloudinary are excluded by the user on 2026-11-15. Keep the existing cover image URL field.
3. Enable Better Auth password reset with queued email delivery, restricted redirect origins, token expiry, request throttling, and session revocation after reset. Reuse the existing email infrastructure.
4. Add owner/admin event summaries, paginated attendee lists, and CSV export. Capture ticket price when reserving so later price edits cannot change historical totals. Report reservation value separately from collected revenue because no payment gateway exists. Escape CSV formulas and exclude access tokens and QR secrets.
5. Add a rate limited ticket recovery endpoint with a generic response for every email address. Queue recovery and send reservation links only to the address submitted. Do not expose reservation details in the HTTP response.
6. Verify Cloudflare Turnstile tokens before inventory allocation, with a timeout, allowed hostnames and action checks. Production must not silently bypass verification when configuration is absent.
7. Move confirmation delivery and outbox deduplication to reservations. Send all QR codes in one email and preserve retry idempotency. Plan migration and deployment around existing queued ticket jobs and delivery timestamps.
8. Update OpenAPI, README.md, and .env.example with endpoints, contracts, deployment order, and required provider settings.

## Verification

Add regression coverage for slug collision and draft visibility, unauthorized reports, historical ticket values, CSV formula escaping, recovery enumeration resistance and throttling, password reset delivery and token behavior, Turnstile failures, and exactly one confirmation for a multi-ticket reservation. Run unit and integration tests, typecheck, build, and formatting checks. Apply and verify migrations against the dedicated local test database. Do not claim hosted delivery or production configuration has been verified without credentials and evidence.

## Status

User approved execution on 2026-11-15, excluding payments and Cloudinary. Work runs inline on backend-completion, based on guest-checkout commit 7615fa7. No commits, pushes, production migrations, or frontend edits are requested.

## Execution ledger

- Step 1. Add integration tests for slug lookup, collisions, ownership, and reports, observe failures, implement schema/service/routes, migrate the test database, and rerun.
- Step 2. Add reservation email and recovery/reset regression tests, observe failures, implement queue changes and migrations, and rerun.
- Step 3. Add Turnstile failure tests, observe failures, implement verification, and rerun.
- Step 4. Update OpenAPI and README, run the full suite, typecheck, build, formatting, and review the diff.
- Existing ticket prices cannot be reconstructed historically. Backfill from the current ticket type price and document this limitation.
- Queue contract changes require stopping old workers and draining old jobs before deployment. No compatibility adapter will be added.

## Implementation and verification record

- Event slugs, unique custom link validation, and public slug lookup are implemented. Existing IDs remain the database identifiers. Only draft events allow edits, matching the existing event editing rule.
- Organizer summaries, paginated attendees, and streamed CSV exports are implemented with owner/admin checks. New reservations capture the ticket price. Reports expose reserved value, not payment revenue.
- Confirmation outbox entries, retry repair, provider idempotency keys, and delivery state now belong to reservations. The worker includes all QR codes in one email. The migration consolidates older outbox rows and preserves fully sent orders.
- Password reset uses Better Auth tokens with 15-minute expiry and session revocation. Reset and recovery messages reuse the auth email queue and authenticated encryption already used for OTP jobs.
- Ticket recovery queues work before any reservation lookup, keeps HTTP replies independent of account existence, and limits both IPs and email addresses. The worker sends links only to the submitted address.
- Turnstile verification checks hostname and checkout action before inventory allocation. Production fails closed without configuration. Development/test bypass applies only when the secret is absent.
- README.md, .env.example, and OpenAPI list the new API contracts and deployment requirements.
- The initial baseline passed 140 tests. The completed implementation passed 155 tests in 28 files, plus the Redis/PostgreSQL end-to-end worker test. Typecheck and build passed. Changed TypeScript and Markdown files pass Prettier. The repository-wide format check reports existing style issues outside the task. An unchanged HEAD version of tsconfig.json also fails its format check.
- Migrations ran against ventra_test and ventra_e2e only. The development and hosted databases were not migrated. Live Resend delivery and a real Turnstile widget remain unverified. The frontend must add its reset/recovery screens, slug routing, reports, and widget.
- Final independent review found one migration defect. Truncating a title at a hyphen could produce an invalid doubled hyphen in its backfilled slug. A PostgreSQL regression test reproduced the failure. A follow-up migration normalizes affected slugs without changing already-applied migration checksums. No other important findings or deferred minors were reported. The implementation handoff left changes uncommitted. The user subsequently requested a pull request.

## Pull request delivery

The user requested a PR after implementation. Verify the completed changes, commit them on backend-completion, push that branch, and open a PR against guest-checkout. Guest checkout is still under review in PR #9, so this base keeps the new PR limited to the backend completion changes. Include the migration and Turnstile rollout requirements in the PR description.
