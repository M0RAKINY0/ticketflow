# Feature Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move users and ticketing access chains from route files into feature middleware files.

**Architecture:** Shared authentication functions remain in `src/middleware/auth.middleware.ts`. Feature middleware files compose those functions into named handler arrays that route files spread before controllers.

**Tech Stack:** TypeScript, Express 5, Vitest, Supertest

**Spec:** `docs/superpowers/specs/2026-08-25-feature-middleware-design.md`

## Global constraints

- Preserve every route path, method, middleware order, controller, status code, and authorization result.
- Add no dependencies.
- Do not create an auth middleware file with no behavior.
- Leave the existing shared authentication implementation unchanged.

---

### Task 1: Extract feature middleware composition

**Files:**

- Create: `src/modules/users/users.middleware.ts`
- Create: `src/modules/ticketing/ticketing.middleware.ts`
- Modify: `src/modules/users/users.routes.ts`
- Modify: `src/modules/ticketing/ticketing.routes.ts`
- Modify: `tests/unit/controller-boundaries.test.ts`
- Modify: `README.md`

**Interfaces:**

- Users middleware produces readonly `authenticated` and `adminOnly` handler arrays.
- Ticketing middleware produces readonly `optionalAuthentication`, `authenticated`, and `authenticatedUserOnly` handler arrays.
- Routes consume those arrays with spread syntax before named controllers.

- [x] **Step 1: Write the failing route-chain test**

Update `tests/unit/controller-boundaries.test.ts` to import the feature middleware arrays and assert complete users and ticketing route chains by function identity.

- [x] **Step 2: Verify RED**

Run `npm test -- tests/unit/controller-boundaries.test.ts`. Expect failure because the two feature middleware modules do not exist.

- [x] **Step 3: Add minimal feature middleware files**

Compose existing shared handlers into readonly arrays. Do not duplicate token or role-checking logic.

- [x] **Step 4: Simplify route files**

Remove direct shared-auth imports from users and ticketing routes. Spread the matching feature middleware arrays before each controller while preserving handler order.

- [x] **Step 5: Verify GREEN**

Run `npm test -- tests/unit/controller-boundaries.test.ts`, all database-free unit tests, `npm run typecheck`, `npm run build`, targeted Prettier, and `git diff --check`.

- [x] **Step 6: Document and commit**

Update the README feature-based MVC section, mark verified plan steps complete, and commit with a descriptive subject and body.
