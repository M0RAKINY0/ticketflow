# Feature middleware design

## Goal

Move feature authorization composition out of route files while keeping shared authentication logic reusable.

## Structure

- Keep token parsing, optional authentication, required authentication, and role enforcement in `src/middleware/auth.middleware.ts`.
- Add `src/modules/users/users.middleware.ts` for users feature access chains.
- Add `src/modules/ticketing/ticketing.middleware.ts` for ticketing feature access chains.
- Do not create an empty auth feature middleware file because all auth routes are public.

## Contracts

Feature middleware files export readonly handler arrays:

- Users exports authenticated and admin-only chains.
- Ticketing exports optional-authentication, authenticated, and authenticated-user-only chains.
- Route files spread those arrays before their controller functions.

Every existing route must retain the same middleware order and HTTP behavior.

## Verification

Update the route-chain tests first so they require feature middleware exports and fail before implementation. Then run the controller-boundary suite, all database-free unit tests, typecheck, build, targeted formatting, and diff checks.
