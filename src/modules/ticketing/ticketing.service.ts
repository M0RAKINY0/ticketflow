import type {
  EventStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client.js';
import { prisma } from '../../infrastructure/prisma.js';
import { AppError } from '../../shared/errors.js';
import {
  createTicketPublicId,
  createTicketQrDataUrl,
  createTicketQrPayload,
  verifyTicketQrPayload,
} from '../../utilities/ticket-qr.js';
import type {
  CreateEventInput,
  CreateTicketTypeInput,
  DiscoveryQuery,
  UpdateEventInput,
  UpdateTicketTypeInput,
} from './ticketing.schema.js';

type Principal = { id: string; role: Role };

const eventInclude = {
  organizer: { select: { id: true, name: true } },
  ticketTypes: { orderBy: { createdAt: 'asc' as const } },
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

export async function listEvents(query: DiscoveryQuery, principal?: Principal) {
  const visibility: Prisma.EventWhereInput =
    principal?.role === 'ADMIN'
      ? {}
      : principal?.role === 'ORGANIZER'
        ? { organizerId: principal.id }
        : { status: 'PUBLISHED', startsAt: { gte: new Date() } };

  const filters: Prisma.EventWhereInput[] = [];
  if (query.query) {
    filters.push({
      OR: [
        { title: { contains: query.query, mode: 'insensitive' } },
        { venue: { contains: query.query, mode: 'insensitive' } },
        { city: { contains: query.query, mode: 'insensitive' } },
        { organizer: { name: { contains: query.query, mode: 'insensitive' } } },
      ],
    });
  }
  if (query.category) filters.push({ category: query.category });
  if (query.countryCode) filters.push({ countryCode: query.countryCode });
  if (query.from || query.to) {
    filters.push({
      startsAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      },
    });
  }

  const where: Prisma.EventWhereInput = {
    AND: [visibility, ...filters],
  };

  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      skip,
      take: query.pageSize,
    }),
    prisma.event.count({ where }),
  ]);

  return { items, page: query.page, pageSize: query.pageSize, total };
}

export async function getEvent(eventId: string, principal?: Principal) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });

  if (!event || !canViewEvent(event.status, event.organizerId, principal)) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event was not found');
  }

  return event;
}

export function createEvent(organizerId: string, input: CreateEventInput) {
  const data: Prisma.EventUncheckedCreateInput = {
    organizerId,
    title: input.title,
    description: input.description,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    venue: input.venue,
    category: input.category,
    city: input.city,
    countryCode: input.countryCode,
    currency: input.currency,
    timezone: input.timezone,
  };
  if (input.coverImageUrl !== undefined)
    data.coverImageUrl = input.coverImageUrl;

  return prisma.event.create({
    data,
    include: eventInclude,
  });
}

export async function updateEvent(
  eventId: string,
  organizerId: string,
  input: UpdateEventInput,
) {
  const event = await requireOwnedEvent(eventId, organizerId);

  if (event.status !== 'DRAFT') {
    throw eventLocked();
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : event.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : event.endsAt;

  if (endsAt <= startsAt) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'endsAt must be after startsAt',
    );
  }

  const data: Prisma.EventUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.startsAt !== undefined) data.startsAt = startsAt;
  if (input.endsAt !== undefined) data.endsAt = endsAt;
  if (input.venue !== undefined) data.venue = input.venue;
  if (input.category !== undefined) data.category = input.category;
  if (input.coverImageUrl !== undefined)
    data.coverImageUrl = input.coverImageUrl;
  if (input.city !== undefined) data.city = input.city;
  if (input.countryCode !== undefined) data.countryCode = input.countryCode;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.timezone !== undefined) data.timezone = input.timezone;

  return prisma.event.update({
    where: { id: eventId },
    data,
    include: eventInclude,
  });
}

export async function publishEvent(eventId: string, organizerId: string) {
  return prisma.$transaction(async (transaction) => {
    const event = await requireOwnedEvent(eventId, organizerId, transaction);

    if (event.status !== 'DRAFT') {
      throw eventLocked();
    }

    const ticketTypeCount = await transaction.ticketType.count({
      where: { eventId },
    });
    if (ticketTypeCount === 0) {
      throw new AppError(
        409,
        'EVENT_HAS_NO_TICKET_TYPES',
        'An event needs at least one ticket type before publication',
      );
    }

    return transaction.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED' },
      include: eventInclude,
    });
  });
}

export async function cancelEvent(eventId: string, organizerId: string) {
  const event = await requireOwnedEvent(eventId, organizerId);

  if (event.status === 'CANCELLED') {
    throw new AppError(
      409,
      'EVENT_ALREADY_CANCELLED',
      'Event is already cancelled',
    );
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: 'CANCELLED' },
    include: eventInclude,
  });
}

export async function listTicketTypes(eventId: string, principal?: Principal) {
  await getEvent(eventId, principal);

  return prisma.ticketType.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createTicketType(
  eventId: string,
  organizerId: string,
  input: CreateTicketTypeInput,
) {
  await requireDraftOwnedEvent(eventId, organizerId);

  try {
    const data: Prisma.TicketTypeUncheckedCreateInput = {
      eventId,
      name: input.name,
      price: input.price,
      capacity: input.capacity,
    };
    if (input.description !== undefined) data.description = input.description;

    return await prisma.ticketType.create({
      data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        'TICKET_TYPE_NAME_EXISTS',
        'A ticket type with this name already exists for the event',
      );
    }

    throw error;
  }
}

export async function updateTicketType(
  eventId: string,
  ticketTypeId: string,
  organizerId: string,
  input: UpdateTicketTypeInput,
) {
  await requireDraftOwnedEvent(eventId, organizerId);
  const ticketType = await prisma.ticketType.findFirst({
    where: { id: ticketTypeId, eventId },
  });

  if (!ticketType) {
    throw new AppError(
      404,
      'TICKET_TYPE_NOT_FOUND',
      'Ticket type was not found',
    );
  }

  if (
    input.capacity !== undefined &&
    input.capacity < ticketType.reservedCount
  ) {
    throw new AppError(
      409,
      'CAPACITY_BELOW_RESERVED_COUNT',
      'Capacity cannot be lower than the reserved ticket count',
    );
  }

  const data: Prisma.TicketTypeUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.capacity !== undefined) data.capacity = input.capacity;

  try {
    return await prisma.ticketType.update({
      where: { id: ticketTypeId },
      data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        409,
        'TICKET_TYPE_NAME_EXISTS',
        'A ticket type with this name already exists for the event',
      );
    }

    throw error;
  }
}

export async function deleteTicketType(
  eventId: string,
  ticketTypeId: string,
  organizerId: string,
): Promise<void> {
  await requireDraftOwnedEvent(eventId, organizerId);
  const removed = await prisma.ticketType.deleteMany({
    where: { id: ticketTypeId, eventId },
  });

  if (removed.count === 0) {
    throw new AppError(
      404,
      'TICKET_TYPE_NOT_FOUND',
      'Ticket type was not found',
    );
  }
}

export async function createReservation(
  eventId: string,
  ticketTypeId: string,
  userId: string,
  idempotencyKey: string,
) {
  const replay = await findReservationByKey(userId, idempotencyKey);
  if (replay) {
    return resolveReservationReplay(replay, eventId, ticketTypeId);
  }

  const publicId = createTicketPublicId();
  const qrCodeDataUrl = await createTicketQrDataUrl(publicId);

  try {
    const reservationId = await prisma.$transaction(async (transaction) => {
      const incremented = await transaction.ticketType.updateMany({
        where: {
          id: ticketTypeId,
          eventId,
          reservedCount: { lt: transaction.ticketType.fields.capacity },
          event: { status: 'PUBLISHED' },
        },
        data: { reservedCount: { increment: 1 } },
      });

      if (incremented.count !== 1) {
        await throwReservationAvailabilityError(
          eventId,
          ticketTypeId,
          transaction,
        );
      }

      const reservation = await transaction.reservation.create({
        data: {
          userId,
          eventId,
          ticketTypeId,
          idempotencyKey,
          ticket: {
            create: {
              publicId,
              qrCodeDataUrl,
              status: 'READY',
            },
          },
        },
        select: { id: true },
      });

      return reservation.id;
    });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      include: reservationInclude,
    });

    return { created: true, reservation: decorateReservation(reservation) };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const concurrentReplay = await findReservationByKey(
        userId,
        idempotencyKey,
      );
      if (concurrentReplay) {
        return resolveReservationReplay(
          concurrentReplay,
          eventId,
          ticketTypeId,
        );
      }
    }

    throw error;
  }
}

export async function listReservations(userId: string) {
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: reservationInclude,
    orderBy: { createdAt: 'desc' },
  });

  return reservations.map(decorateReservation);
}

export async function listTickets(userId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { reservation: { userId } },
    include: ticketInclude,
    orderBy: { createdAt: 'desc' },
  });

  return tickets.map(decorateTicket);
}

export async function getTicket(ticketId: string, userId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, reservation: { userId } },
    include: ticketInclude,
  });

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found');
  }

  return decorateTicket(ticket);
}

export async function getTicketQr(ticketId: string, userId: string) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, reservation: { userId } },
    select: { publicId: true, qrCodeDataUrl: true },
  });

  if (!ticket) {
    throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket was not found');
  }

  if (!ticket.qrCodeDataUrl) {
    throw new AppError(
      409,
      'TICKET_QR_NOT_READY',
      'Ticket QR code is not ready',
    );
  }

  return {
    qrCodeDataUrl: ticket.qrCodeDataUrl,
    qrPayload: createTicketQrPayload(ticket.publicId),
  };
}

export async function createCheckIn(
  eventId: string,
  operator: Principal,
  qrPayload: string,
) {
  await requireCheckInAccess(eventId, operator);
  const publicId = verifyTicketQrPayload(qrPayload);

  const checkInId = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findFirst({
      where: { publicId, reservation: { eventId } },
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new AppError(
        404,
        'TICKET_NOT_FOUND',
        'Ticket was not found for this event',
      );
    }

    const consumed = await transaction.ticket.updateMany({
      where: { id: ticket.id, status: 'READY' },
      data: { status: 'USED' },
    });

    if (consumed.count !== 1) {
      throw new AppError(
        409,
        'TICKET_ALREADY_USED',
        'Ticket has already been used',
      );
    }

    const checkIn = await transaction.checkIn.create({
      data: {
        ticketId: ticket.id,
        eventId,
        checkedInById: operator.id,
      },
      select: { id: true },
    });

    return checkIn.id;
  });

  return prisma.checkIn.findUniqueOrThrow({
    where: { id: checkInId },
    include: checkInInclude,
  });
}

export async function listCheckIns(eventId: string, operator: Principal) {
  await requireCheckInAccess(eventId, operator);

  return prisma.checkIn.findMany({
    where: { eventId },
    include: checkInInclude,
    orderBy: { checkedInAt: 'desc' },
  });
}

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

function canViewEvent(
  status: EventStatus,
  organizerId: string,
  principal?: Principal,
): boolean {
  return (
    status === 'PUBLISHED' ||
    principal?.role === 'ADMIN' ||
    (principal?.role === 'ORGANIZER' && principal.id === organizerId)
  );
}

async function requireOwnedEvent(
  eventId: string,
  organizerId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const event = await client.event.findUnique({ where: { id: eventId } });

  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event was not found');
  }

  if (event.organizerId !== organizerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this event');
  }

  return event;
}

async function requireDraftOwnedEvent(eventId: string, organizerId: string) {
  const event = await requireOwnedEvent(eventId, organizerId);
  if (event.status !== 'DRAFT') {
    throw eventLocked();
  }

  return event;
}

async function requireCheckInAccess(eventId: string, operator: Principal) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event was not found');
  }

  if (operator.role !== 'ADMIN' && event.organizerId !== operator.id) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'You cannot manage check-ins for this event',
    );
  }
}

async function throwReservationAvailabilityError(
  eventId: string,
  ticketTypeId: string,
  transaction: Prisma.TransactionClient,
): Promise<never> {
  const event = await transaction.event.findUnique({
    where: { id: eventId },
    select: { status: true },
  });

  if (!event || event.status !== 'PUBLISHED') {
    throw new AppError(
      409,
      'EVENT_NOT_AVAILABLE',
      'Event is not available for reservations',
    );
  }

  const ticketType = await transaction.ticketType.findFirst({
    where: { id: ticketTypeId, eventId },
    select: { capacity: true, reservedCount: true },
  });

  if (!ticketType) {
    throw new AppError(
      404,
      'TICKET_TYPE_NOT_FOUND',
      'Ticket type was not found',
    );
  }

  throw new AppError(409, 'TICKET_TYPE_SOLD_OUT', 'Ticket type is sold out');
}

function findReservationByKey(userId: string, idempotencyKey: string) {
  return prisma.reservation.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: reservationInclude,
  });
}

function resolveReservationReplay<
  Reservation extends {
    eventId: string;
    ticketTypeId: string;
    ticket: null | { publicId: string };
  },
>(reservation: Reservation, eventId: string, ticketTypeId: string) {
  if (
    reservation.eventId !== eventId ||
    reservation.ticketTypeId !== ticketTypeId
  ) {
    throw new AppError(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'Idempotency key was already used for another reservation',
    );
  }

  return { created: false, reservation: decorateReservation(reservation) };
}

function decorateReservation<
  Reservation extends { ticket: null | { publicId: string } },
>(reservation: Reservation) {
  return {
    ...reservation,
    ticket: reservation.ticket ? decorateTicket(reservation.ticket) : null,
  };
}

function decorateTicket<Ticket extends { publicId: string }>(ticket: Ticket) {
  return { ...ticket, qrPayload: createTicketQrPayload(ticket.publicId) };
}

function eventLocked(): AppError {
  return new AppError(
    409,
    'EVENT_NOT_DRAFT',
    'Only draft events can be modified',
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
