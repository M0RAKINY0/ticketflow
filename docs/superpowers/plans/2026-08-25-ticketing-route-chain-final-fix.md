# Ticketing route-chain final fix implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ticketing route matrix prove the full registered handler chain for all 17 ticketing endpoints.

**Architecture:** Keep the production router unchanged. The unit test imports the ticketing controller functions and stores each route's expected handler array in the table that drives the assertions. Direct array equality verifies handler count, middleware order, and controller identity. The role-checking closure on reservations remains a single function slot, and the existing HTTP test continues to prove it denies non-USER principals.

**Tech Stack:** TypeScript, Express router internals, Vitest, Supertest, Prettier.

**Spec:** User-provided final-review finding from 2026-08-25.

## Global constraints

- Change tests only unless the investigation finds a production defect.
- Cover all 17 ticketing routes with complete expected handler arrays.
- Use imported controller function references, not function-name strings.
- Keep the existing HTTP behavior tests.
- Run the specified targeted test, targeted Prettier, typecheck, and `git diff --check` before committing.

---

### Task 1: Strengthen ticketing route-boundary coverage

**Files:**

- Modify: `tests/unit/controller-boundaries.test.ts`
- Create: `.superpowers/sdd/2026-08-25-feature-based-mvc-refactor/final-fix-report.md`

**Interfaces:**

- Consumes: `ticketingRouter`, `authenticate`, `authenticateOptional`, and the 17 exported ticketing controller functions.
- Produces: A route matrix that compares each registered route stack with its full expected handler array.

- [ ] **Step 1: Record the expected handler arrays in the route table**

```ts
["get", "/events", [authenticateOptional, listEventsController]];
```

Include every ticketing route. For reservations, use `[authenticate, expect.any(Function), createReservationController]` because `requireRole("USER")` creates the router's role-checking closure. The existing HTTP test verifies that closure rejects an `ADMIN` token.

- [ ] **Step 2: Run the focused test after the assertion change**

Run: `npm test -- tests/unit/controller-boundaries.test.ts`

Expected: all focused tests pass, including the retained reservation authorization and HTTP behavior tests.

- [ ] **Step 3: Format only the changed test and documentation files**

Run: `npx prettier --write tests/unit/controller-boundaries.test.ts docs/superpowers/plans/2026-08-25-ticketing-route-chain-final-fix.md .superpowers/sdd/2026-08-25-feature-based-mvc-refactor/final-fix-report.md`

Expected: Prettier reports each targeted path as written or unchanged.

- [ ] **Step 4: Run static and diff verification**

Run: `npm run typecheck` and `git diff --check`

Expected: TypeScript exits with code 0 and the diff check prints no whitespace errors.

- [ ] **Step 5: Write the final-fix report and commit**

Document the changed files, the exact command output, and the conclusion that no production issue was found. Commit the test and required documentation with a subject that names the strengthened ticketing route-chain assertions and a body that explains the regression coverage.
