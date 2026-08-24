# Feature-based MVC Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Ventra API into feature-based MVC modules while preserving every existing API behavior.

**Architecture:** Feature routers delegate to controllers, controllers handle HTTP translation, services retain business rules, and models own Prisma access. Shared authentication and error handling move into middleware, while a root router composes health and feature routes.

**Tech Stack:** Node.js 24, TypeScript, Express 5, Prisma 7, Zod 4, Vitest, Supertest

**Spec:** `docs/superpowers/specs/2026-08-25-feature-based-mvc-design.md`

## Global constraints

- Preserve all current endpoints, status codes, cookies, response envelopes, and authorization behavior.
- Do not leave compatibility exports or duplicate old files.
- Keep ticketing as one feature module during this refactor.
- Keep existing Prisma transaction boundaries and conditional writes intact.
- Do not add dependencies.

---

### Task 1: Extract shared middleware and root route composition

**Files:**

- Create: `src/middleware/auth.middleware.ts`
- Create: `src/middleware/error.middleware.ts`
- Create: `src/routes/health.routes.ts`
- Create: `src/routes/index.ts`
- Modify: `src/app.ts`
- Delete: `src/shared/auth.ts`
- Test: `tests/unit/route-composition.test.ts`
- Test: `tests/integration/health.test.ts`

**Interfaces:**

- Produces: `authenticate`, `authenticateOptional`, `requireRole`, `errorHandler`, `healthRouter`, and `apiRouter`
- Consumes: existing `AppError`, token verification, and feature router exports

- [ ] **Step 1: Add a failing route-composition test**

Create `tests/unit/route-composition.test.ts` that imports `apiRouter`, inspects its Express stack, and asserts that `/auth` plus the users and ticketing routers are mounted. Keep the existing health integration test as the contract for `/health`.

- [ ] **Step 2: Run the focused tests and confirm the missing root router fails**

Run `npm test -- tests/unit/route-composition.test.ts tests/integration/health.test.ts`. Expect the new test to fail because `src/routes/index.ts` does not exist.

- [ ] **Step 3: Move authentication middleware**

Move the contents of `src/shared/auth.ts` to `src/middleware/auth.middleware.ts` without changing the exported signatures:

```ts
export function authenticate(
  request: Request,
  response: Response,
  next: NextFunction,
): void;
export function authenticateOptional(
  request: Request,
  response: Response,
  next: NextFunction,
): void;
export function requireRole(...roles: Role[]): RequestHandler;
```

Update feature imports and remove `src/shared/auth.ts`.

- [ ] **Step 4: Extract error middleware and health routing**

Export `errorHandler: ErrorRequestHandler` from `src/middleware/error.middleware.ts`. Export an Express router from `src/routes/health.routes.ts` with `GET /health` returning `{ data: { status: 'ok' } }`.

- [ ] **Step 5: Compose routes and simplify the app**

Create `src/routes/index.ts` with a root router that mounts health at `/health`, auth at `/api/v1/auth`, and users and ticketing at `/api/v1`. Keep `src/app.ts` limited to cookie parsing, JSON parsing, root route mounting, and the error handler.

- [ ] **Step 6: Run focused verification**

Run `npm test -- tests/unit/route-composition.test.ts tests/integration/health.test.ts` and `npm run typecheck`. Expect both tests and type checking to pass.

### Task 2: Convert auth and users to MVC modules

**Files:**

- Create: `src/modules/auth/auth.controller.ts`
- Create: `src/modules/auth/auth.model.ts`
- Modify: `src/modules/auth/auth.routes.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Delete: `src/modules/auth/auth.repository.ts`
- Delete: `src/services/auth.ts`
- Create: `src/modules/users/users.controller.ts`
- Create: `src/modules/users/users.model.ts`
- Create: `src/modules/users/users.schema.ts`
- Modify: `src/modules/users/users.routes.ts`
- Modify: `src/modules/users/users.service.ts`
- Delete: `src/modules/users/users.repository.ts`
- Test: `tests/unit/controller-boundaries.test.ts`

**Interfaces:**

- Produces: named Express handlers for every auth and users endpoint
- Consumes: unchanged auth and users service function signatures

- [ ] **Step 1: Add failing controller-boundary tests**

Create `tests/unit/controller-boundaries.test.ts`. Assert that auth and users route source files contain route declarations but do not import service modules, and that controller source files import their matching services.

- [ ] **Step 2: Run the boundary test and confirm current routes fail it**

Run `npm test -- tests/unit/controller-boundaries.test.ts`. Expect failure because both route files currently import services directly.

- [ ] **Step 3: Extract auth controllers**

Move register, login, refresh, and logout request handling into named handlers in `auth.controller.ts`. Keep cookie settings, validation mapping, status codes, and response envelopes unchanged. Change `auth.routes.ts` to route declarations only.

- [ ] **Step 4: Rename the auth repository and colocate password operations**

Rename `auth.repository.ts` to `auth.model.ts`, export `authModel`, and update `auth.service.ts`. Move `hashPassword` and `verifyPassword` from `src/services/auth.ts` into the auth feature, then remove the generic service file.

- [ ] **Step 5: Extract users schemas and controllers**

Move `userIdSchema`, `roleSchema`, and `userListQuerySchema` into `users.schema.ts`. Move `getMe`, `getUsers`, and `patchUserRole` handlers into `users.controller.ts`. Keep `users.routes.ts` limited to paths, authentication middleware, role middleware, and controller handlers.

- [ ] **Step 6: Rename the users repository**

Rename `users.repository.ts` to `users.model.ts`, export `usersModel`, and update service imports without changing query behavior.

- [ ] **Step 7: Run focused verification**

Run `npm test -- tests/unit/controller-boundaries.test.ts tests/unit/auth-cookie.test.ts tests/unit/role-model.test.ts` and `npm run typecheck`. Expect all focused tests and type checking to pass.

### Task 3: Convert ticketing routes to controllers and isolate data access

**Files:**

- Create: `src/modules/ticketing/ticketing.controller.ts`
- Create: `src/modules/ticketing/ticketing.model.ts`
- Modify: `src/modules/ticketing/ticketing.routes.ts`
- Modify: `src/modules/ticketing/ticketing.service.ts`
- Rename: `src/modules/ticketing/authorization.ts` to `src/modules/ticketing/ticketing.authorization.ts`
- Test: `tests/unit/controller-boundaries.test.ts`
- Test: `tests/unit/event-ownership.test.ts`
- Test: `tests/unit/ticketing-schema-runtime.test.ts`

**Interfaces:**

- Produces: one named controller per ticketing route and `ticketingModel` for reusable Prisma operations
- Consumes: existing ticketing schemas, service functions, principal types, and Prisma transaction behavior

- [ ] **Step 1: Extend the boundary test for ticketing**

Assert that `ticketing.routes.ts` does not import `ticketing.service.ts`, does not parse schemas, and delegates each route to a named controller.

- [ ] **Step 2: Run the boundary test and confirm ticketing fails it**

Run `npm test -- tests/unit/controller-boundaries.test.ts`. Expect failure because `ticketing.routes.ts` currently owns all HTTP handlers.

- [ ] **Step 3: Extract ticketing controllers**

Move the 17 existing route handlers and the Zod-to-`AppError` mapping into `ticketing.controller.ts`. Keep every parse call, principal requirement, service call, status code, and success envelope unchanged. Leave only route and middleware declarations in `ticketing.routes.ts`.

- [ ] **Step 4: Add the ticketing model boundary**

Create `ticketing.model.ts` and move reusable direct Prisma reads and writes from the service into `ticketingModel`. Keep transaction callbacks in the service when they coordinate multiple writes or depend on conditional update counts. The model must accept an existing transaction client for operations used inside transactions.

- [ ] **Step 5: Rename ticketing authorization**

Rename `authorization.ts` to `ticketing.authorization.ts` and update imports. Preserve `EventPrincipal` and `canManageEvent` exactly.

- [ ] **Step 6: Run focused verification**

Run `npm test -- tests/unit/controller-boundaries.test.ts tests/unit/event-ownership.test.ts tests/unit/ticketing-schema-runtime.test.ts` and `npm run typecheck`. Expect all focused tests and type checking to pass.

### Task 4: Document and verify the MVC architecture

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-25-feature-based-mvc-refactor.md`

**Interfaces:**

- Consumes: final source tree and npm commands
- Produces: contributor documentation that matches the implemented module boundaries

- [ ] **Step 1: Update the README architecture section**

Document route, controller, service, model, schema, and middleware responsibilities. State that Prisma schema files remain under `prisma/` while feature model files own runtime database access.

- [ ] **Step 2: Run all available verification**

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run format:check`. If PostgreSQL credentials still block database tests, record the exact failure and run every database-free unit test separately.

- [ ] **Step 3: Check the migration is complete**

Run `git grep` for imports of `shared/auth`, `services/auth`, `auth.repository`, `users.repository`, and direct service imports from route files. Confirm no replaced files or stale imports remain. Run `git diff --check`.

- [ ] **Step 4: Review the working tree**

Confirm the frontend-removal changes remain intact, the MVC refactor does not restore `web/`, and no unrelated files were overwritten.
