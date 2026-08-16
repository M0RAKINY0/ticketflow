# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The frontend is a React and Vite application in `web/` inside the existing Ventra repository. Production is one deployment: Express serves the built SPA and Vite proxies API calls during development.

## Users

- Users discover events, reserve tickets, create events, manage their own ticket types, retrieve tickets online or offline, and scan tickets for events they own.
- Administrators manage every user and event, including event-scoped check-in.

## Product Purpose

Ventra provides one responsive event experience from discovery through exactly-once admission. Success means an attendee can find and reserve an event quickly and venue staff can validate a ticket confidently from a phone.

## Positioning

Ventra joins a public discovery-first event marketplace to simple owner operations and secure one-time QR check-in within two account types: User and Admin.

## Operating Context

Attendees commonly browse on mobile and may need to present a previously viewed ticket without connectivity. Event owners set up events on desktop and perform check-in primarily on phones under time pressure and variable lighting.

## Capabilities and Constraints

- The existing Express API remains the source of truth.
- Public visitors may browse published events; reservations require a `USER` account.
- QR tickets use static signed opaque payloads, camera scanning, and manual-entry fallback.
- Ventra is global from v1. Each event records an ISO 4217 currency, IANA timezone, city, and ISO 3166-1 alpha-2 country code.
- Payments are not included; ticket price is informational.
- Every authenticated User can create events. The creating user is the event owner; ownership or Admin authority controls management.
- Existing Organizer accounts are converted to User accounts during migration without changing event ownership.

## Brand Commitments

- The product name is Ventra.
- The interface uses familiar event-marketplace conventions at an Eventbrite and Luma quality bar.
- Discovery is the public front door; event-owner and administrator tools remain clear authenticated destinations.
- No existing logo or visual assets are authoritative. The frontend establishes the first Ventra identity.

## Evidence on Hand

The repository contains the working Express/Prisma ticketing API and integration tests. There are no customer logos, testimonials, photography assets, performance claims, or commercial claims; the frontend must not fabricate them.

## Product Principles

- Discovery is the front door.
- Tickets must feel trustworthy and remain easy to retrieve.
- Event-owner tools favor clarity and speed over dashboard density.
- Check-in results must be unmistakable under venue pressure.
- Ownership reveals event capability without making users learn separate products.

## Accessibility & Inclusion

The responsive web application targets WCAG 2.2 AA, supports keyboard navigation and reduced motion, presents QR codes at a readable size, and provides non-camera check-in fallback.
