import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createReservationAccessToken,
  isReservationAccessToken,
  isReservationLinkLive,
  RESERVATION_LINK_GRACE_MS,
} from "../../src/utilities/reservation-access.js";

const reservation = {
  id: "8d3f5b0e-2c1a-4f6e-9b7d-1a2b3c4d5e6f",
  accessVersion: 1,
};

describe("reservation access links", () => {
  it("rejects old links after a reset, old-style links, and links 30 days past the event", () => {
    const token = createReservationAccessToken(reservation);
    expect(isReservationAccessToken(reservation, token)).toBe(true);

    // A reset raises the version, which kills the old token.
    expect(
      isReservationAccessToken({ ...reservation, accessVersion: 2 }, token),
    ).toBe(false);

    // Links signed the old way, with the QR secret, no longer verify.
    const legacy = createHmac("sha256", process.env.TICKET_QR_SECRET!)
      .update(`reservation-access:${reservation.id}`)
      .digest("base64url");
    expect(isReservationAccessToken(reservation, legacy)).toBe(false);

    const endsAt = new Date("2026-12-20T23:00:00Z");
    const lastDay = new Date(endsAt.getTime() + RESERVATION_LINK_GRACE_MS);
    expect(isReservationLinkLive(endsAt, lastDay)).toBe(true);
    expect(isReservationLinkLive(endsAt, new Date(lastDay.getTime() + 1))).toBe(
      false,
    );
  });
});
