# Repository root relocation plan

## Purpose

Move the Ventra Git repository from `C:\Users\morak\ventra\ticketflow` to `C:\Users\morak\ventra`. The shorter path becomes the only project root and removes the accidental second dependency installation in the parent directory.

## Current state

- The real repository, including `.git`, source code, tests, documentation, and its installed dependencies, is under `ticketflow`.
- The parent directory contained an accidental `package.json`, `package-lock.json`, and `node_modules` installation.
- The repository has a linked `feature/mvc-refactor` worktree under `.worktrees`.
- The checkout and linked worktree have no uncommitted files.

## Procedure

1. Check out the latest local `main` branch in the primary worktree.
2. Move the accidental parent-level `package.json`, `package-lock.json`, and `node_modules` directory to `C:\Users\morak\ventra-accidental-dependencies-backup` so the cleanup remains recoverable.
3. Move every entry from `ticketflow`, including hidden files and `.git`, into the parent `ventra` directory.
4. Repair Git's worktree metadata for the relocated primary and linked worktrees.
5. Remove the empty `ticketflow` directory.
6. Move the stale, ignored top-level Prisma output into the same backup. The active generated client lives at `src/generated/prisma`.
7. Install dependencies from the repository lockfile in the new root and regenerate the Prisma client.
8. Run the full test suite, type checking, and production build from the new root.
9. Commit this plan from the relocated repository.

## Result

`C:\Users\morak\ventra` is the Git repository root. All future shell, development, test, and deployment commands run from that directory.
