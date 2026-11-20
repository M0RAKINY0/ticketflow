import type { Prisma } from "../../generated/prisma/client.js";
import { ticketingModel } from "./ticketing.model.js";
import { ownedBy } from "./ticketing.service.js";

type Page = { page: number; pageSize: number };

/** Events the user hosted that have ended, newest first, cancelled ones included. */
export async function listHostedHistory(
  userId: string,
  page: Page,
  now = new Date(),
) {
  const { events, total } = await ticketingModel.hostedHistory(
    userId,
    now,
    page,
  );

  return {
    items: events.map(({ ticketTypes, ...event }) => ({
      ...event,
      ticketsSold: ticketTypes.reduce(
        (sum, type) => sum + type.reservedCount,
        0,
      ),
    })),
    total,
    ...page,
  };
}

/**
 * Ended events the user held valid tickets for, newest first. Cancelled
 * events and cancelled orders are left out. `checkedIn` says whether a
 * ticket was scanned at the door.
 */
export async function listAttendedHistory(
  userId: string,
  page: Page,
  now = new Date(),
) {
  const owned: Prisma.ReservationWhereInput = {
    AND: [
      await ownedBy(userId),
      { status: "CONFIRMED" },
      { tickets: { some: { status: { not: "VOID" } } } },
    ],
  };
  const { events, total } = await ticketingModel.attendedHistory(
    owned,
    now,
    page,
  );

  return {
    items: events.map(({ reservations, ...event }) => {
      const tickets = reservations.flatMap((r) => r.tickets);
      return {
        ...event,
        reservationIds: reservations.map((r) => r.id),
        ticketCount: tickets.filter((t) => t.status !== "VOID").length,
        checkedIn: tickets.some((t) => t.status === "USED"),
      };
    }),
    total,
    ...page,
  };
}
