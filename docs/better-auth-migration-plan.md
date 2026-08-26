# Better Auth backend migration

## Goal

Replace Ventra's custom authentication with Better Auth 1.7.2. Support email and password, Google OAuth, secure browser sessions, and 15-minute JWTs without adding frontend or Apple code.

## Current data

This migration targets development. Reset the `ventra` and `ventra_test` databases instead of converting existing users, events, reservations, tickets, or check-ins.

## Implementation

1. Add Better Auth and JOSE to the backend package.
2. Replace the custom user password and refresh-token schema with Better Auth's user, account, session, verification, and JWKS records.
3. Mount Better Auth at `/api/v1/auth` before the JSON parser.
4. Configure email and password, Google OAuth, secure sessions, and JWT issuance.
5. Replace custom bearer-token middleware with Better Auth session and JWT authentication while preserving the existing `{ id, role }` request principal.
6. Remove obsolete authentication endpoints, hashing code, token code, dependencies, and tests.
7. Document the new endpoints, environment variables, database reset, and verification commands.

## Constraints

- Keep UUID user IDs and the `USER` and `ADMIN` roles.
- `phoneNumber` is optional.
- Public signup cannot choose an administrative role.
- Google uses `http://localhost:4000/api/v1/auth/callback/google` in development.
- Existing custom auth endpoints do not remain available.
- The populated `.env` stays outside Git.

## Verification

- Exercise email signup, email signin, session retrieval, signout, Google redirect generation, JWT issuance, session authorization, JWT authorization, and invalid-token rejection.
- Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run format:check`.
