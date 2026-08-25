# Pull Request CI Workflow Implementation Plan

**Goal:** Run the complete backend verification suite automatically for pull requests targeting `main`.

**Architecture:** One GitHub Actions job runs on Ubuntu with Node.js 24 and a PostgreSQL 17 service. The job installs the locked dependency graph, generates Prisma, applies migrations to an isolated test database, then runs tests, type checking, and the production build.

**Data:** CI uses test-only `ventra` credentials. `DATABASE_URL` points to a separate unused application database name and `TEST_DATABASE_URL` points to the PostgreSQL service database created for the job.

## Implementation

- [x] Create `.github/workflows/ci.yml` for `pull_request` events targeting `main`.
- [x] Grant read-only repository contents permission.
- [x] Cancel stale runs for the same pull request.
- [x] Configure PostgreSQL health checks and Node.js 24 with npm caching.
- [x] Run `npm ci`, Prisma generation, test migrations, the full test suite, type checking, and build.
- [x] Document CI behavior in `README.md`.
- [x] Validate workflow formatting and run locally available commands.
