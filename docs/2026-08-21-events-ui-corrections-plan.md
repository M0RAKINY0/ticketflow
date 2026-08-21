# Events UI Corrections Plan

## Purpose

Repair the event discovery interactions without changing the visual direction of the existing landing page.

## Chunks

1. **Interaction contracts and tests**
   - Add coverage for opening a detail dialog from the event card and reserving an event.
   - Define the lightweight client-side login destination used until authentication exists.

2. **Event scroller and detail flow**
   - Give the animated hero media a larger white frame while keeping the intended rotating layers visible inside it.
   - Make the full browse card clickable and keyboard accessible.
   - Centralize event details in one dialog, add a blurred backdrop, and add a Reserve event action.

3. **How-it-works behavior**
   - Keep horizontal scrolling and arrow navigation from the Apple carousel.
   - Preserve the original Apple card visuals and make the card surfaces non-interactive.
   - Remove copy that implies cards open into another view.

4. **Login destination and verification**
   - Add a `/login` view with a return-to-events action.
   - Verify build, lint, tests, desktop/mobile layout, keyboard interaction, modal blur, and the reservation redirect.

## Product Decisions

- Reservation redirects to `/login`; no authentication or backend is introduced in this slice.
- The event detail dialog remains the single source of truth for hero and browse-card details.
- The How it works carousel remains horizontally navigable but never opens a modal.
- Event card images and hero media must stay visually contained by their owning frame without losing the intended rotation.

## Follow-up Correction

- Restore the original animated hero layering and Apple card visuals.
- Increase the hero panel padding to create a larger white frame around rotating media; do not clip the rotations.
- Remove the orange offset bar from the How it works cards.
- Keep How it works cards visually identical to the original version, but render them as non-interactive surfaces.

## Create Interface Follow-up

1. **Scrollable event date selection**
   - Replace manually typed dates in every create-event form with a horizontally scrollable set of upcoming dates.
   - Keep the selected date in the existing `EventDraft.date` contract so publishing behavior remains unchanged.

2. **Inline create surface**
   - Remove the `Create an event` CTA and the four informational stat tiles from the `Put it on the map` band.
   - Place the complete create-event form directly in that section so the primary creation workflow is visible without opening a drawer.
   - Reuse the same form in the existing drawer to keep validation, image upload, and event creation behavior consistent.

3. **Verification**
   - Verify that no date text input remains, date choices scroll on narrow screens, inline publishing still appends an event, and the drawer continues to reset correctly after close.

## Verification Record

- `npm test`: 9 tests passed across 6 files.
- `npm run lint`: passed with no warnings.
- `npm run build`: passed.
- Browser checks: inline form present, informational tiles and section CTA removed, 35 date choices render, date picker scrolls without page overflow at 390px, drawer reuses the picker, and Escape closes the drawer.

## iOS Picker Follow-up

- Replace the horizontal date cards and manual time field with compact linked wheel columns inspired by the supplied iOS alarm reference.
- Keep the existing draft string values and validation flow while adding keyboard movement and selected-state semantics to each wheel.
- Tighten the create layout to a 1040px inner shell, 40px column gap, and 480px form cap so the left copy does not leave an oversized empty area.
