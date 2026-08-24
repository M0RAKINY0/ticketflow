# Ventra backend

This repository contains the backend foundation for Ventra, the city-guide event product. The frontend is maintained separately. The current backend slice is intentionally small: it exposes a health probe and establishes the HTTP and configuration boundaries that future authentication, events, reservations, and ticketing routes will inherit.

## Security baseline

- Helmet security headers are enabled for every response.
- Express fingerprinting is disabled.
- JSON request bodies are limited to 1 MB.
- CORS accepts only explicit HTTP(S) origins from `FRONTEND_ORIGINS`; wildcard origins are rejected.
- A process-local rate limit protects the API boundary before product routes are added.
- Malformed, oversized, CORS, unknown-route, and unexpected errors return bounded JSON responses without stack traces.
- Runtime configuration is validated before the server starts.
- Node HTTP deadlines are explicit: incomplete headers close after 15 seconds, requests after 30 seconds, idle sockets after 30 seconds, and keep-alive sockets after 5 seconds. Internet-facing proxies and load balancers must use limits no longer than these values.
- The default bind host is `127.0.0.1`; deployments that need an external interface must set `HOST` deliberately.
- `.env` files are ignored and `.env.example` contains placeholders only.

Authentication, authorization, event ownership, reservation transactions, QR tickets, Redis workers, and persistence routes are not implemented in this checkout yet. They must be added behind the existing boundary with route-level validation, authentication, authorization, and transaction-specific tests.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The health probe is available at `http://127.0.0.1:4000/health` by default.

## Verification

```bash
npm run typecheck
npm run build
npm test
npm audit --audit-level=high
```

## Pull request checks

The [`Backend CI`](.github/workflows/backend-ci.yml) workflow runs for every pull request and can also be started manually. It installs from `package-lock.json`, typechecks and builds the backend, runs the automated tests, validates and generates the Prisma client, and rejects high-severity dependency advisories.

Security-hardening work is documented in [`docs/2026-08-24-backend-security-hardening-plan.md`](docs/2026-08-24-backend-security-hardening-plan.md).
