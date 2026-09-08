# OpenAPI documentation design

Ventra will expose one OpenAPI 3.1 contract at `/api/openapi.json` and Swagger UI at `/api/docs`. Better Auth's built-in OpenAPI plugin will generate authentication paths, including Google, JWT, and email OTP endpoints. Ventra will own the application paths for health, users, events, ticket types, reservations, tickets, QR retrieval, and check-ins.

The contract will define session-cookie and bearer-JWT security schemes, shared success and error envelopes, UUID path parameters, pagination parameters, request bodies, response status codes, and representative examples. Admin-only and owner-or-admin rules will be stated in operation descriptions.

`src/infrastructure/openapi.ts` will merge Better Auth's generated paths and components into the Ventra document. `src/routes/docs.routes.ts` will serve JSON and Swagger UI. The docs route will replace Helmet's content security policy with a route-specific policy that permits Swagger's self-hosted scripts and inline bootstrap while leaving all other API responses unchanged.

Tests will validate the document shape, both HTTP endpoints, security headers, and coverage of every explicitly registered Ventra route. README documentation will name both URLs. No database schema changes are required.
