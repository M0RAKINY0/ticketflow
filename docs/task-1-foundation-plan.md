# Ventra Foundation Implementation Plan

**Purpose:** Establish the configuration, HTTP composition, persistence contract, and test harness required by the remaining Ventra ticketing backend tasks.

**Task data:** The implementation follows `.superpowers/sdd/2026-08-14-ventra-ticketing-backend/task-1-brief.md` and the committed Ventra architecture/design. It must use Node.js >=24, TypeScript, Express 5, Prisma 7 with PostgreSQL and `@prisma/adapter-pg`, Zod 4, Vitest, and Supertest. Integration tests must reject a `TEST_DATABASE_URL` equal to `DATABASE_URL`.

## Plan

1. Normalize package scripts, TypeScript configuration, Prisma configuration, ignored files, and dependencies for the API, worker, formatting, Prisma, and Vitest workflows.
2. Write focused environment and health tests, run each test to record the expected missing-module failure, then add the minimum production code for the tests to pass.
3. Add an `.env.example`, validated Zod environment parsing, shared response/error primitives, a listen-free Express app factory, and a server startup entry point.
4. Replace the draft Prisma schema with the complete four-enum/seven-model contract. Add a PostgreSQL initial migration with foreign keys, indexes, uniqueness constraints, cascade actions, and numeric check constraints.
5. Generate Prisma client output, run the focused tests, typecheck, and production build. Inspect the staged diff, commit only the Task 1 deliverables, and record evidence in the SDD task report.
