import { OutboxEventType, type Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/prisma.js";

export const ticketingEventInclude = {
  organizer: { select: { id: true, name: true } },
  ticketTypes: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.EventInclude;

export const reservationInclude = {
  event: true,
  tickets: {
    include: { ticketType: true },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.ReservationInclude;

const ticketInclude = {
  reservation: { include: { event: true } },
  ticketType: true,
  checkIn: true,
} satisfies Prisma.TicketInclude;

const checkInInclude = {
  checkedInBy: { select: { id: true, name: true } },
  ticket: {
    include: {
      reservation: {
        select: { id: true, buyerName: true, buyerEmail: true },
      },
      ticketType: true,
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

  findBuyer(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, emailVerified: true },
    });
  },

  findReservationByKey(buyerEmail: string, idempotencyKey: string) {
    return prisma.reservation.findUnique({
      where: { buyerEmail_idempotencyKey: { buyerEmail, idempotencyKey } },
      include: reservationInclude,
    });
  },

  findReservation(
    reservationId: string,
    owner: Prisma.ReservationWhereInput = {},
  ) {
    return prisma.reservation.findFirst({
      where: { AND: [{ id: reservationId }, owner] },
      include: reservationInclude,
    });
  },

  /** Attaches a guest reservation to an account. Does nothing once it has an owner. */
  claimReservation(reservationId: string, userId: string) {
    return prisma.reservation.updateMany({
      where: { id: reservationId, userId: null },
      data: { userId },
    });
  },

  async ensureTicketEmailOutbox(ticketId: string): Promise<void> {
    await prisma.$executeRaw`
      WITH eligible_ticket AS (
        SELECT "id"
        FROM "Ticket"
        WHERE "id" = ${ticketId}::uuid
          AND "emailSentAt" IS NULL
        FOR UPDATE
      )
      INSERT INTO "OutboxEvent" ("id", "type", "aggregateId")
      SELECT
        gen_random_uuid(),
        ${OutboxEventType.TICKET_EMAIL_REQUESTED}::"OutboxEventType",
        "id"
      FROM eligible_ticket
      ON CONFLICT ("type", "aggregateId") DO NOTHING
    `;
  },

  listReservations(owner: Prisma.ReservationWhereInput) {
    return prisma.reservation.findMany({
      where: owner,
      include: reservationInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  listTickets(owner: Prisma.ReservationWhereInput) {
    return prisma.ticket.findMany({
      where: { reservation: owner },
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  findTicket(ticketId: string, owner: Prisma.ReservationWhereInput) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, reservation: owner },
      include: ticketInclude,
    });
  },

  findTicketQr(ticketId: string, owner: Prisma.ReservationWhereInput) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, reservation: owner },
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
