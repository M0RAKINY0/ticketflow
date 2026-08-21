# iOS-Style Event Picker Plan

## Purpose

Make the event creation flow feel more like the supplied iOS alarm reference while reducing the visual weight and unused space in the create section.

## Chunks

1. **Wheel picker foundation**
   - Add a reusable vertical wheel column with a centered selected row, muted neighboring rows, snap scrolling, keyboard support, and reduced-motion-safe transitions.
   - Add linked date wheels for weekday, day, and month using the existing upcoming-date options.
   - Add linked time wheels for hour, minute, and AM/PM using five-minute increments.

2. **Form integration and layout tightening**
   - Replace manual date and time inputs in the shared create form with the new pickers.
   - Preserve `EventDraft.date` and `EventDraft.time` as formatted strings and keep existing validation and publishing behavior.
   - Reduce the create section's left-column width, grid gap, and form panel width without changing its content or drawer behavior.

3. **Verification**
   - Test picker selection, keyboard interaction, generated values, and the absence of manual date/time text fields.
   - Run tests, lint, build, and desktop/mobile browser checks for sizing and horizontal overflow in both the inline form and drawer.

## Verification Record

- Focused picker tests: 3 passed across 2 files.
- Full suite: 11 tests passed across 7 files.
- Browser checks: three date wheels and three time wheels render in the inline form and drawer; keyboard movement changes the time; 390px viewport width remains overflow-free.
