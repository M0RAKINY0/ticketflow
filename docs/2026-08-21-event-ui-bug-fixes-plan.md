# Event UI Bug Fixes

## Purpose

Resolve the visual defects captured in the supplied hero screenshot and the
follow-up create-event review while preserving the existing Events design
language and interaction contracts.

## Scope

1. Contain the rotated hero image layers inside a larger, stable white panel.
2. Align hero title, category, description, controls, metadata, and counter to
   a consistent reading rhythm.
3. Reduce create-event density by pairing category with price and date with
   time on wider screens, while keeping a single-column mobile fallback.
4. Make the date wheel compact and expose distinct month choices instead of
   repeating the same month label for every date in that month.

## Verification

- Add regression tests for unique date-month options and the paired form
  groups before implementation.
- Run the full Vitest suite, lint, and production build.
- Run the Impeccable mechanical detector on changed UI files.
- Check the hero and create-event section at desktop and mobile widths for
  image containment, alignment, readable text, keyboard behavior, and no
  horizontal overflow.

## Constraints

- Keep the existing `EventDraft` date/time string contract.
- Keep the iOS-inspired wheel interaction and keyboard semantics.
- Do not add backend persistence or new dependencies.
