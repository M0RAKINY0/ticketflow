# Runtime startup compatibility plan

## Purpose

Make the backend boot under Node's native ESM loader for the installed `i18n-iso-countries` package so the local API can be visually tested.

## Root cause

The package's Node entry point is CommonJS and exports one library object. Its TypeScript declarations expose named functions, but Node cannot synthesize the named `isValid` ESM export from that entry point, so importing the schema crashes before Express starts.

## Plan

1. Add a focused schema validation test that imports the runtime module and checks valid and invalid country codes.
2. Run the focused test to capture the current ESM import failure.
3. Adapt the import to the package's CommonJS runtime shape without changing validation behavior.
4. Rerun the focused test, API typecheck/build, and a live `/health` smoke test before starting the frontend.

## Acceptance criteria

- The focused country validation test passes under Node 24 ESM.
- `npm run dev` remains alive and `/health` returns the existing success envelope.
- No payment or unrelated behavior changes are introduced.
