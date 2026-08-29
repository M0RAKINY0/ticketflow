import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";

export const ticketingEventInclude = {
  organizer: { select: { id: true, name: true } },
  ticketTypes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.EventInclude;

const reservationInclude = {
  event: true,
  ticketType: true,
  ticket: true,
} satisfies Prisma.ReservationInclude;

const ticketInclude = {
  reservation: {
    include: {
      event: true,
      ticketType: true,
    },
  },
  checkIn: true,
} satisfies Prisma.TicketInclude;

const checkInInclude = {
  checkedInBy: { select: { id: true, name: true } },
  ticket: {
    include: {
      reservation: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          ticketType: true,
        },
      },
    },
  },
} satisfies Prisma.CheckInInclude;

export const ticketingModel = {
  async listEvents(input: {
    where: Prisma.EventWhereInput;
    skip: number;
    take: number;
  }) {
    const [items, total] = await prisma.$transaction([
      prisma.event.findMany({
        where: input.where,
        include: ticketingEventInclude,
        orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        skip: input.skip,
        take: input.take,
      }),
      prisma.event.count({ where: input.where }),
    ]);

    return { items, total };
  },

  findEventById(eventId: string) {
    return prisma.event.findUnique({
      where: { id: eventId },
      include: ticketingEventInclude,
    });
  },

  findEventForManagement(eventId: string) {
    return prisma.event.findUnique({ where: { id: eventId } });
  },

  findEventOwner(eventId: string) {
    return prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
  },

  createEvent(data: Prisma.EventUncheckedCreateInput) {
    return prisma.event.create({ data, include: ticketingEventInclude });
  },

  updateEvent(eventId: string, data: Prisma.EventUpdateInput) {
    return prisma.event.update({
      where: { id: eventId },
      data,
      include: ticketingEventInclude,
    });
  },

  listTicketTypes(eventId: string) {
    return prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  },

  createTicketType(data: Prisma.TicketTypeUncheckedCreateInput) {
    return prisma.ticketType.create({ data });
  },

  findTicketType(eventId: string, ticketTypeId: string) {
    return prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
    });
  },

  updateTicketType(ticketTypeId: string, data: Prisma.TicketTypeUpdateInput) {
    return prisma.ticketType.update({ where: { id: ticketTypeId }, data });
  },

  deleteTicketType(eventId: string, ticketTypeId: string) {
    return prisma.ticketType.deleteMany({
      where: { id: ticketTypeId, eventId },
    });
  },

  findReservationByKey(userId: string, idempotencyKey: string) {
    return prisma.reservation.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: reservationInclude,
    });
  },

  findReservationById(reservationId: string) {
    return prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: reservationInclude,
    });
  },

  findReservationTicketEmail(reservationId: string) {
    return prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: {
        user: { select: { email: true, name: true } },
        event: { select: { title: true, startsAt: true, timezone: true } },
        ticketType: { select: { name: true } },
        ticket: {
          select: {
            id: true,
            publicId: true,
            qrCodeDataUrl: true,
            emailSentAt: true,
          },
        },
      },
    });
  },

  markTicketEmailSent(ticketId: string, emailSentAt: Date) {
    return prisma.ticket.updateMany({
      where: { id: ticketId, emailSentAt: null },
      data: { emailSentAt },
    });
  },

  listReservations(userId: string) {
    return prisma.reservation.findMany({
      where: { userId },
      include: reservationInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  listTickets(userId: string) {
    return prisma.ticket.findMany({
      where: { reservation: { userId } },
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  findTicket(ticketId: string, userId: string) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, reservation: { userId } },
      include: ticketInclude,
    });
  },

  findTicketQr(ticketId: string, userId: string) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, reservation: { userId } },
      select: { publicId: true, qrCodeDataUrl: true },
    });
  },

  findCheckInById(checkInId: string) {
    return prisma.checkIn.findUniqueOrThrow({
      where: { id: checkInId },
      include: checkInInclude,
    });
  },

  listCheckIns(eventId: string) {
    return prisma.checkIn.findMany({
      where: { eventId },
      include: checkInInclude,
      orderBy: { checkedInAt: "desc" },
    });
  },
};
