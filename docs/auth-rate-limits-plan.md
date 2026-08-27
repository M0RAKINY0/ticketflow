# Auth rate limits implementation plan

## Goal

Replace Better Auth's broad default with explicit limits for each public authentication operation. Keep the existing API-wide limit at 100 requests per minute because it protects ordinary API traffic, not password guessing.

## Scope

- Enable Better Auth rate limiting in development and production. Integration tests create an isolated rate-limited auth instance so counters cannot leak between test cases.
- Keep the Better Auth fallback at 100 requests per 60 seconds per IP.
- Limit password sign-in to 5 requests per 15 minutes per IP.
- Limit email signup to 5 requests per hour per IP.
- Limit Google sign-in initialization to 20 requests per minute per IP.
- Limit session reads and JWT issuance to 60 requests per minute per IP.
- Limit sign-out to 20 requests per minute per IP.
- Return Better Auth's standard HTTP 429 response when an auth limit is exceeded.
- Leave Redis, email OTP, Resend, password reset, and account-keyed counters for the next auth change.

## Implementation

1. Add an integration test that sends six invalid password sign-in requests from one IP. The first five must reach credential validation and the sixth must return HTTP 429.
2. Add named rate-limit constants to `src/infrastructure/auth.ts` and pass them to Better Auth through `rateLimit.customRules`.
3. Run the focused auth test and the full test suite.
4. Update the README authentication section with the enforced limits and the current IP-only storage constraint.
5. Run type checking, the production build, and formatting checks.

## Data and security notes

Better Auth derives these counters from the connecting IP. This release uses its in-memory store, so counters are local to one Node.js process. A later Redis change will share counters across instances and add independent account-keyed limits. No passwords, tokens, cookies, or email addresses will be written to rate-limit keys in this change.
