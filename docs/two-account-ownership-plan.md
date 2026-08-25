# Two-account ownership model implementation plan

## Goal

Replace the `USER`/`ORGANIZER`/`ADMIN` role model with only `USER` and `ADMIN`. Every authenticated user may create events and reserve tickets. The creator owns the event; ownership or admin authority controls event management and event-scoped check-in. Existing `ORGANIZER` rows become `USER` during migration.

## Workstreams

1. **RED contract tests**: add backend tests proving regular users can create/manage their own events, cannot manage another user's event, admins can manage all events, and organizer role assignment/filtering no longer exists. Add frontend guard/header tests proving every authenticated user sees Create event and can enter event management.
2. **Database and auth**: remove `ORGANIZER` from Prisma and checked-in SQL migration; convert existing organizer rows before enum replacement; update token role validation and user schemas/services.
3. **Ownership authorization**: replace organizer role middleware on event/ticket/check-in mutations with authentication plus owner-or-admin checks. Keep public discovery visibility correct for normal users and admins.
4. **Frontend and docs**: restrict role type to `USER | ADMIN`, replace organizer route guard with authenticated access, show Create event for every signed-in user, and update README, PRODUCT.md, and design/planning docs.
5. **Verification**: run focused RED/GREEN tests, typecheck, build, diff checks, and the full backend/frontend suites. Live PostgreSQL integration remains a separate final gate if the local server is available.

## Migration safety

The migration updates all `ORGANIZER` users to `USER` before replacing the enum. Event ownership remains in `Event.organizerId`; the field name is retained for schema/API stability while its meaning is documented as event owner.
