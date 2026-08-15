# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

The frontend is a React and Vite application in `web/` inside the existing Ventra repository. Production is one deployment: Express serves the built SPA and Vite proxies API calls during development.

## Users

- Attendees discover events, reserve a ticket, retrieve it online or offline, and present its QR code.
- Organizers create events and ticket types, monitor reservations, and scan tickets at entry.
- Administrators find users and promote them to organizer status.

## Product Purpose

Ventra provides one responsive event experience from discovery through exactly-once admission. Success means an attendee can find and reserve an event quickly and venue staff can validate a ticket confidently from a phone.

## Positioning

Ventra joins a public discovery-first event marketplace to simple organizer operations and secure one-time QR check-in within one role-aware account.

## Operating Context

Attendees commonly browse on mobile and may need to present a previously viewed ticket without connectivity. Organizers set up events on desktop and perform check-in primarily on phones under time pressure and variable lighting.

## Capabilities and Constraints

- The existing Express API remains the source of truth.
- Public visitors may browse published events; reservations require a `USER` account.
- QR tickets use static signed opaque payloads, camera scanning, and manual-entry fallback.
- Ventra is global from v1. Each event records an ISO 4217 currency, IANA timezone, city, and ISO 3166-1 alpha-2 country code.
- Payments are not included; ticket price is informational.
- The first frontend release includes attendee, organizer, and small administrator areas.

## Brand Commitments

- The product name is Ventra.
- The interface uses familiar event-marketplace conventions at an Eventbrite and Luma quality bar.
- Discovery is the public front door; organizer and administrator tools remain clear authenticated destinations.
- No existing logo or visual assets are authoritative. The frontend establishes the first Ventra identity.

## Evidence on Hand

The repository contains the working Express/Prisma ticketing API and integration tests. There are no customer logos, testimonials, photography assets, performance claims, or commercial claims; the frontend must not fabricate them.

## Product Principles

- Discovery is the front door.
- Tickets must feel trustworthy and remain easy to retrieve.
- Organizer tools favor clarity and speed over dashboard density.
- Check-in results must be unmistakable under venue pressure.
- Role changes reveal capability without making users learn separate products.

## Accessibility & Inclusion

The responsive web application targets WCAG 2.2 AA, supports keyboard navigation and reduced motion, presents QR codes at a readable size, and provides non-camera check-in fallback.
