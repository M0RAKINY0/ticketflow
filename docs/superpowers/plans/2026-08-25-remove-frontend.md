# Remove Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the repository to a backend-only Node.js service without losing the existing uncommitted work.

**Architecture:** Keep the Express application, Prisma data layer, and backend tests in the root project. Remove the `web` npm workspace and every frontend-only command and dependency while retaining CORS for the separately deployed client.

**Tech Stack:** Node.js 24, TypeScript, Express 5, Prisma 7, Vitest

**Spec:** `docs/superpowers/specs/2026-08-25-backend-only-repository-design.md`

## Global constraints

- The frontend lives in a separate repository and must not remain here.
- Preserve the pre-cleanup working tree in `backup/pre-frontend-removal-2026-08-25`.
- Do not change backend API behavior as part of this cleanup.
- Update `README.md` before committing.

---

### Task 1: Remove the frontend workspace

**Files:**

- Delete: `web/`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: npm workspace metadata and root scripts
- Produces: one backend-only npm package with the existing backend commands

- [ ] **Step 1: Delete the tracked `web/` directory**

Run `git rm -r web` after confirming the backup branch contains the current frontend files.

- [ ] **Step 2: Remove frontend package metadata**

Delete the `workspaces` entry, `dev:web`, `build:web`, `typecheck:web`, `test:web`, and `test:e2e` scripts, plus `@playwright/test`.

- [ ] **Step 3: Regenerate the lockfile**

Run `npm install --package-lock-only` and confirm `package-lock.json` has no `web` workspace package.

- [ ] **Step 4: Remove frontend ignore rules**

Delete the `/web/` build and TypeScript artifact entries from `.gitignore`.

### Task 2: Document and verify the backend-only repository

**Files:**

- Modify: `README.md`
- Test: `tests/unit/**/*.test.ts`
- Test: `tests/integration/**/*.test.ts`

**Interfaces:**

- Consumes: the remaining root npm scripts and API routes
- Produces: accurate setup and verification instructions for backend contributors

- [ ] **Step 1: Rewrite frontend-specific README sections**

Describe this repository as the Ventra API. Remove React, Vite, browser storage, proxy, and frontend command instructions.

- [ ] **Step 2: Run backend verification**

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run format:check`. Fix only failures caused by this cleanup.

- [ ] **Step 3: Review the final diff**

Confirm no tracked frontend files or frontend package references remain and that backend edits restored from the backup branch are still present.
