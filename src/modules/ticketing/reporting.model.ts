import { prisma } from "../../infrastructure/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
const attendeeSelect = {
  id: true,
  publicId: true,
  status: true,
  unitPrice: true,
  createdAt: true,
  ticketType: { select: { name: true } },
  reservation: {
    select: { id: true, buyerName: true, buyerEmail: true, status: true },
  },
  checkIn: { select: { checkedInAt: true } },
} satisfies Prisma.TicketSelect;
export const reportingModel = {
  event: (id: string) => prisma.event.findUnique({ where: { id } }),
  async sales(eventId: string) {
    const where: Prisma.TicketWhereInput = {
      reservation: { eventId, status: "CONFIRMED" },
      status: { not: "VOID" },
    };
    const [groups, reservationCount, types] = await prisma.$transaction(
      [
        prisma.ticket.groupBy({
          by: ["ticketTypeId"],
          where,
          _count: { _all: true },
          _sum: { unitPrice: true },
        }),
        prisma.reservation.count({ where: { eventId, status: "CONFIRMED" } }),
        prisma.ticketType.findMany({
          where: { eventId },
          orderBy: { createdAt: "asc" },
        }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { groups, reservationCount, types };
  },
  async attendees(eventId: string, skip: number, take: number) {
    const where = { reservation: { eventId } };
    const [items, total] = await prisma.$transaction(
      [
        prisma.ticket.findMany({
          where,
          select: attendeeSelect,
          orderBy: { id: "asc" },
          skip,
          take,
        }),
        prisma.ticket.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return { items, total };
  },
  exportBatch: (eventId: string, cursor?: string) =>
    prisma.ticket.findMany({
      where: { reservation: { eventId } },
      select: attendeeSelect,
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
};
