# Backend Security Hardening Plan

## Purpose

Harden the Ticketflow/Ventra backend bootstrap before feature endpoints are added. The current repository is an Express and Prisma skeleton, so this task focuses on security controls that can be implemented and verified now without inventing authentication, event, reservation, or ticket behavior that does not exist yet.

## Scope

- Audit the current backend with the Codex Security standard scan.
- Establish secure HTTP defaults for headers, request parsing, CORS, and error responses.
- Validate security-sensitive environment configuration at startup.
- Keep secrets and local configuration out of version control.
- Add focused automated checks for the security boundary.
- Run type checking, production build, tests, dependency audit, and a follow-up security scan.

## Implementation chunks

1. **Baseline audit**
   - Record the repository state and run the standard security scan against the backend checkout.
   - Trace reported findings to reachable code and distinguish implemented risks from future product work.

2. **HTTP boundary hardening**
   - Add security headers through a maintained middleware library.
   - Disable framework fingerprinting.
   - Bound JSON request bodies.
   - Replace permissive CORS with an explicit environment-backed allowlist.
   - Return safe error responses without stack traces or internal details.

3. **Configuration and operational safety**
   - Parse and validate runtime configuration with clear development and production behavior.
   - Add a documented environment template without real secrets.
   - Keep startup and shutdown behavior predictable for deployment and tests.

4. **Verification**
   - Add tests for headers, CORS decisions, body limits, malformed JSON handling, and safe error output.
   - Run `npm run typecheck`, `npm run build`, `npm test`, `npm audit`, and the follow-up security scan.

## Constraints

- No frontend changes are included; the frontend is being handled separately.
- No authentication or authorization endpoints are fabricated while the route layer is empty.
- No secrets, tokens, or production origins are committed.
- Preserve the simplest maintainable architecture so later JWT, RBAC, event, and reservation modules inherit the hardened app boundary.
