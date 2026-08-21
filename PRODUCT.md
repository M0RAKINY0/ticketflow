# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + React + TypeScript with Tailwind CSS, shadcn/ui, and
Aceternity UI components.

## Users

People discovering urban social events and looking for a compelling next plan.
Event organizers are a secondary audience for the first slice.

## Product Purpose

Events helps people discover social events, understand the essential details,
and see how an event listing can be created. Success for this first slice is a
clear, engaging discovery flow with a working local event-creation demo.

## Positioning

The first slice makes event discovery feel like browsing a living city guide:
the event itself is the primary content, with motion used to switch between
realistic event examples and details available without leaving the surface.

## Operating Context

Visitors browse on desktop or mobile, scan event imagery and metadata, expand
events for more information, learn the basic flow, and optionally create a
local demo event with a custom image.

## Capabilities and Constraints

- The app is client-only for this slice; there is no backend or persistent
  storage.
- Seeded event data is local and demo-oriented.
- A created event lives in in-memory state and is reset on refresh.
- Event images accept one JPEG, PNG, or WebP file up to 5 MB.
- The visible product label is `Events`.
- No legacy UI or backward compatibility is required because this workspace is
  new.

## Brand Commitments

- Use the literal product label `Events` during this build.
- Keep copy focused on discovery, event details, and making a new event.

## Evidence on Hand

No real event catalogue, organizer identities, ticketing data, customer proof,
or production media has been supplied. Seeded content and imagery must remain
clearly demonstrative and replaceable.

## Product Principles

- Make the event content immediately understandable.
- Let imagery and metadata carry the discovery experience.
- Keep interactions direct, reversible, and keyboard-accessible.
- Build the first end-to-end slice without persistence that the product does
  not yet require.

## Accessibility & Inclusion

The web surface must provide keyboard access, visible focus, readable contrast,
semantic labels, Escape and outside-click close behavior, reduced-motion
support, and responsive layouts without clipped content.
