# Auth and users MVC modules implementation plan

**Goal:** Move auth and users HTTP handling into feature controllers while preserving their existing API contracts.

**Architecture:** Auth and users routers retain only endpoint declarations, shared authentication middleware, role checks, and named controller handlers. Controllers own parsing, response envelopes, cookie operations, and error forwarding. Feature models own Prisma queries, while feature services own the use cases and password helpers.

**Tech stack:** Node.js, Express 5, TypeScript, Zod, Prisma, Vitest, Supertest.

**Source brief:** `.superpowers/sdd/2026-08-25-feature-based-mvc-refactor/task-2-brief.md`

## Constraints

- Preserve every existing endpoint, status code, cookie setting, response envelope, and authorization result.
- Add no dependencies and leave no compatibility exports or duplicate predecessor files.
- Do not run the credential-dependent database suite. Run the specified database-free tests and typecheck.
- Use test-first changes and record RED and GREEN evidence in the task report.

## File plan

- Create `src/modules/auth/auth.controller.ts` for register, login, refresh, and logout handlers.
- Rename `src/modules/auth/auth.repository.ts` to `src/modules/auth/auth.model.ts` and expose `authModel`.
- Update `src/modules/auth/auth.service.ts` to use `authModel` and own bcrypt helpers.
- Reduce `src/modules/auth/auth.routes.ts` to auth paths and controller handlers, then remove `src/services/auth.ts`.
- Create `src/modules/users/users.schema.ts` for the request schemas.
- Create `src/modules/users/users.controller.ts` for current-user, list-users, and role-assignment handlers.
- Rename `src/modules/users/users.repository.ts` to `src/modules/users/users.model.ts` and expose `usersModel`.
- Update `src/modules/users/users.service.ts` and restrict `src/modules/users/users.routes.ts` to middleware and handlers.
- Add `tests/unit/controller-boundaries.test.ts` for controller response/error behavior and route middleware/handler wiring.
- Write `.superpowers/sdd/2026-08-25-feature-based-mvc-refactor/task-2-report.md` with test evidence and self-review.

## Execution

1. Add controller-boundary tests for a successful auth response, validation forwarding, missing refresh cookie, user-controller responses, and each route's middleware plus controller handler.
2. Run the test file and confirm it fails because the controllers and named exports do not exist.
3. Move the auth database access object to `auth.model.ts`, put password hashing in `auth.service.ts`, add named auth handlers, and connect the auth router.
4. Move user schemas and database access to their feature files, add named user handlers, and connect the users router with the existing authentication and role middleware.
5. Re-run the focused test file until it passes, then run the required focused regression tests and `npm run typecheck`.
6. Inspect the staged diff for API drift, stale imports, duplicate files, and accidental unrelated changes. Commit the implementation and write the final report.
