# Events

Events is a client-only Vite + React + TypeScript event-discovery slice. It presents local demo plans, expands event details, explains the browse-to-create journey, and lets a user publish an event with an image preview. New events live in memory and intentionally reset on refresh.

## Stack

- Vite, React, TypeScript
- Tailwind CSS v4 and shadcn/ui primitives
- Aceternity animated testimonials, expandable-card, Apple cards carousel, and file-upload foundations
- Motion for interaction transitions
- Oxlint and Vitest for checks

## Run It

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173/` by default.

## Checks

```bash
npm test
npm run lint
npm run build
```

## Product Structure

- `src/types/events.ts` contains the event and draft contracts.
- `src/data/events.ts` contains the five seeded demo events and three how-it-works steps.
- `src/components/events/` contains the extracted event primitives and feature adapters.
- `src/components/ui/` contains shadcn and Aceternity-derived primitives.
- `public/events/` contains local demo photography so the experience does not depend on a remote image service.
- `DESIGN.md` records the visual system after verification.

## Image Upload

The create drawer accepts one JPEG, PNG, or WebP image up to 5 MB. The preview uses a local object URL, supports replacement and removal, and is owned by the in-memory event after publish. There is no backend or persistent storage in this slice.

