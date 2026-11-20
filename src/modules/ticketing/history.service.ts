import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";
import { ownedBy } from "./ticketing.service.js";

type Page = { page: number; pageSize: number };

const historyEventSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  venue: true,
  city: true,
  countryCode: true,
  category: true,
  coverImageUrl: true,
  currency: true,
} satisfies Prisma.EventSelect;

/** Events the user hosted that have ended, newest first, cancelled ones included. */
export async function listHostedHistory(
  userId: string,
  { page, pageSize }: Page,
  now = new Date(),
) {
  const where: Prisma.EventWhereInput = {
    organizerId: userId,
    status: { not: "DRAFT" },
    endsAt: { lt: now },
  };
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      select: {
        ...historyEventSelect,
        ticketTypes: { select: { reservedCount: true } },
      },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    items: events.map(({ ticketTypes, ...event }) => ({
      ...event,
      ticketsSold: ticketTypes.reduce(
        (sum, type) => sum + type.reservedCount,
        0,
      ),
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * Ended events the user held valid tickets for, newest first. Cancelled
 * events and cancelled orders are left out. `checkedIn` says whether a
 * ticket was scanned at the door.
 */
export async function listAttendedHistory(
  userId: string,
  { page, pageSize }: Page,
  now = new Date(),
) {
  const owned: Prisma.ReservationWhereInput = {
    AND: [
      await ownedBy(userId),
      { status: "CONFIRMED" },
      { tickets: { some: { status: { not: "VOID" } } } },
    ],
  };
  const where: Prisma.EventWhereInput = {
    status: "PUBLISHED",
    endsAt: { lt: now },
    reservations: { some: owned },
  };
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      select: {
        ...historyEventSelect,
        reservations: {
          where: owned,
          select: { id: true, tickets: { select: { status: true } } },
        },
      },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.event.count({ where }),
  ]);

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
    page,
    pageSize,
  };
}
