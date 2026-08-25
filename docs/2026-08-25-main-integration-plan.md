# Main integration plan

## Purpose

Merge the feature-based MVC refactor with the security hardening currently on `main`, then open and merge a pull request.

## Repository state

- Source branch: `feature/mvc-refactor`
- Target branch: `main`
- The feature branch runs the API from `src`.
- The current `main` hardening commit targets obsolete root-level server files.
- The pull request workflow must test migrations, the full test suite, type checking, and the production build.

## Plan

1. Merge `origin/main` into the feature branch without committing.
2. Keep `src` as the only application source tree and remove obsolete root-level server files.
3. Port the security controls from `main` into the active environment, app, and HTTP server modules.
4. Add focused tests for configuration, HTTP middleware, and timeout behavior.
5. Update the README and environment example for the merged architecture.
6. Run the database-free tests, type checking, build, and formatting checks locally.
7. Commit and push the integrated branch.
8. Open a pull request, wait for GitHub Actions, and merge only after the checks pass.
