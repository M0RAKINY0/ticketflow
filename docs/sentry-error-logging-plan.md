# Sentry error logging plan

## Purpose

Add backend error reporting to Ventra with the official Sentry Node SDK. The integration reports unexpected server failures without changing API responses or sending expected client errors.

## Configuration

- Read `SENTRY_DSN` from the environment as an optional URL.
- Initialize Sentry only when a DSN is present and the process is not running tests.
- Set the Sentry environment from `NODE_ENV`.
- Keep personally identifiable information and performance tracing disabled.

## Request handling

- Load Sentry instrumentation before the application and its dependencies.
- Install Sentry's Express error handler after routes and before Ventra's error handler.
- Report unexpected errors that produce HTTP 500 responses.
- Do not report 4xx `AppError` responses, malformed JSON, oversized bodies, denied origins, or other expected client failures.
- Preserve Ventra's current JSON error envelope.

## Tests and documentation

- Test environment parsing with and without a valid DSN.
- Test the Sentry error filter for expected and unexpected errors.
- Test middleware ordering and unchanged HTTP responses.
- Update `.env.example` and `README.md` with setup and privacy behavior.
- Run the full test suite, type checking, the production build, and formatting checks for changed files.
