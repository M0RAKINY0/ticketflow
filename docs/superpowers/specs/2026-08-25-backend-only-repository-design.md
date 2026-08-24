# Backend-only repository design

## Goal

Remove the React application from this repository because the frontend now has its own repository. Keep Ventra's Express API, Prisma schema, migrations, and backend tests here.

## Changes

- Delete the tracked `web/` workspace.
- Remove frontend workspace declarations, scripts, Playwright, and frontend-only dependencies from the root package metadata.
- Remove frontend build artifacts from `.gitignore`.
- Rewrite the README around backend setup, API behavior, and backend verification commands.
- Keep CORS support because a separately deployed browser client still needs controlled access to the API.
- Preserve all pre-cleanup work in `backup/pre-frontend-removal-2026-08-25`.

## Verification

Install the backend-only dependency graph, then run the unit and integration-capable test command, type checking, the production build, and formatting checks.
