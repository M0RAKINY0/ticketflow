# Pull Request CI Plan

## Purpose

Add a GitHub Actions merge gate for the Ventra backend so every pull request runs the same installation, compilation, test, Prisma, and dependency-security checks used locally.

## Workflow design

- Create `.github/workflows/backend-ci.yml`.
- Trigger the workflow for pull requests and manual dispatches.
- Grant read-only repository contents access.
- Use Ubuntu and Node.js 20 with the npm cache backed by `package-lock.json`.
- Install dependencies reproducibly with `npm ci`.
- Run type checking, production build, automated tests, Prisma schema validation, Prisma client generation, and a high-severity dependency audit.
- Prevent overlapping runs for the same pull request or ref from wasting CI capacity.

## Verification

- Add a YAML-parsing test that checks the trigger, permissions, runtime, cache, and command sequence.
- Run the workflow test through the repository test command.
- Run each CI command locally and confirm zero failures.
- Update `README.md` with the pull-request gate.
