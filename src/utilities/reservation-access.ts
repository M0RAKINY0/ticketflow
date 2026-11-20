import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

// Version 2 signs with its own secret and the reservation's access version.
// Version 1 links, signed with the ticket QR secret, no longer verify.
const PURPOSE = "reservation-access:v2:";

/** Links keep working until 30 days after the event ends. */
export const RESERVATION_LINK_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** What a link signature covers. Bumping `accessVersion` kills every older link. */
export type ReservationLinkTarget = { id: string; accessVersion: number };

/** Lets a buyer without an account open their reservation from an emailed link. */
export function createReservationAccessToken(
  reservation: ReservationLinkTarget,
): string {
  return createHmac("sha256", env.RESERVATION_ACCESS_SECRET)
    .update(`${PURPOSE}${reservation.id}:${reservation.accessVersion}`)
    .digest("base64url");
}

export function isReservationAccessToken(
  reservation: ReservationLinkTarget,
  token: string,
): boolean {
  const expected = Buffer.from(createReservationAccessToken(reservation));
  const supplied = Buffer.from(token);

  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

export function isReservationLinkLive(eventEndsAt: Date, now: Date): boolean {
  return now.getTime() <= eventEndsAt.getTime() + RESERVATION_LINK_GRACE_MS;
}

/** The frontend page for a reservation. The first frontend origin is the public one. */
export function createReservationUrl(
  reservation: ReservationLinkTarget,
): string {
  const token = createReservationAccessToken(reservation);

  return `${env.FRONTEND_ORIGINS[0]}/reservations/${reservation.id}?token=${token}`;
}
