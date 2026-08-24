# HTTP timeout remediation plan

## Task data

- Finding occurrence: `occ_12f90621b8febab0b421b84e`
- Remediation request: `0e627145-a519-4fdd-859c-80f2d2fef3f0`
- Target: `work/ticketflow-source`

## Purpose

Set finite Node HTTP deadlines before traffic reaches Express. Keep normal
health requests and existing backend behavior intact.

## Plan

1. Configure explicit header, request, socket, and keep-alive deadlines at the
   shared HTTP server boundary.
2. Keep server startup behavior unchanged while making the listener testable.
3. Add raw-socket tests for incomplete headers and incomplete request bodies.
4. Document the limits required for Internet-facing proxies and load balancers.
5. Run type checking, the full test suite, and patch checks.
6. Commit the backend hardening and timeout remediation, then push `main` to
   the configured GitHub remote.
