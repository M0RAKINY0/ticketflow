import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

// The prefix keeps these signatures apart from ticket QR signatures, which
// sign a bare public ID with the same secret.
const PURPOSE = "reservation-access:";

/** Lets a buyer without an account open their reservation from an emailed link. */
export function createReservationAccessToken(reservationId: string): string {
  return createHmac("sha256", env.TICKET_QR_SECRET)
    .update(`${PURPOSE}${reservationId}`)
    .digest("base64url");
}

export function isReservationAccessToken(
  reservationId: string,
  token: string,
): boolean {
  const expected = Buffer.from(createReservationAccessToken(reservationId));
  const supplied = Buffer.from(token);

  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}

/** The frontend page for a reservation. The first frontend origin is the public one. */
export function createReservationUrl(reservationId: string): string {
  const token = createReservationAccessToken(reservationId);

  return `${env.FRONTEND_ORIGINS[0]}/reservations/${reservationId}?token=${token}`;
}
