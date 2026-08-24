# Feature-based MVC design

## Goal

Refactor the Ventra API into feature-based MVC modules without changing its public HTTP contract.

## Structure

Each feature owns its controller, model, routes, schema, and service files:

```text
src/modules/<feature>/
  <feature>.controller.ts
  <feature>.model.ts
  <feature>.routes.ts
  <feature>.schema.ts
  <feature>.service.ts
```

Shared Express concerns live outside feature modules:

```text
src/middleware/
  auth.middleware.ts
  error.middleware.ts
src/routes/
  health.routes.ts
  index.ts
```

## Responsibilities

- Routes declare paths and middleware chains. They do not parse input, call services, or build responses.
- Controllers translate HTTP requests into service calls and translate service results into HTTP responses.
- Services implement business rules and transactions without depending on Express request or response objects.
- Models contain Prisma reads and writes. Existing repository objects become model objects.
- Schemas contain Zod validation for request bodies, parameters, query strings, and headers.
- Middleware handles authentication, role checks, body-parser errors, application errors, and unknown errors.
- `src/routes/index.ts` mounts the health and feature routers.
- `src/app.ts` configures Express middleware, mounts the root router, and installs the error handler.

## Scope decisions

- Keep `auth`, `users`, and `ticketing` as the three feature modules.
- Keep ticketing together during this refactor. Events, ticket types, reservations, tickets, and check-ins can become separate modules in a later change.
- Rename `auth.repository.ts` and `users.repository.ts` to `auth.model.ts` and `users.model.ts`.
- Add `ticketing.model.ts` and move direct Prisma access out of `ticketing.service.ts` where practical without changing transaction behavior.
- Move `src/shared/auth.ts` to `src/middleware/auth.middleware.ts`.
- Move the error handler and body-parser error mapping from `src/app.ts` to `src/middleware/error.middleware.ts`.
- Move health handling from `src/app.ts` to `src/routes/health.routes.ts`.
- Move password hashing from the generic `src/services/auth.ts` file into the auth feature.
- Preserve utilities that are shared by more than one feature, including token and QR helpers.
- Remove replaced files after all imports move. Do not leave compatibility exports.

## Compatibility

The refactor must preserve:

- Every existing URL and HTTP method.
- Authentication and authorization behavior.
- Status codes, cookies, headers, and JSON response envelopes.
- Prisma transaction and concurrency behavior.
- Environment variable names and startup behavior.

## Verification

- Add controller and route-composition tests before moving behavior.
- Run backend unit tests that do not require PostgreSQL.
- Run the full suite when valid test database credentials are available.
- Run TypeScript type checking, the production build, and formatting checks.
