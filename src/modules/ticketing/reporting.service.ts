import { Prisma, type Role } from "../../generated/prisma/client.js";
import { AppError } from "../../shared/errors.js";
import { canManageEvent } from "./ticketing.authorization.js";
import { reportingModel } from "./reporting.model.js";
type Principal = { id: string; role: Role };
async function ownedEvent(eventId: string, principal: Principal) {
  const event = await reportingModel.event(eventId);
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event was not found");
  if (!canManageEvent(principal, event.organizerId))
    throw new AppError(403, "FORBIDDEN", "You do not own this event");
  return event;
}
export async function eventSales(eventId: string, principal: Principal) {
  const event = await ownedEvent(eventId, principal);
  const { groups, types, reservationCount } =
    await reportingModel.sales(eventId);
  const ticketTypes = types.map((type) => {
    const group = groups.find((g) => g.ticketTypeId === type.id);
    return {
      id: type.id,
      name: type.name,
      capacity: type.capacity,
      ticketCount: group?._count._all ?? 0,
      reservedValue: (group?._sum.unitPrice ?? new Prisma.Decimal(0)).toFixed(
        2,
      ),
    };
  });
  return {
    eventId,
    eventStatus: event.status,
    currency: event.currency,
    reservationCount,
    ticketCount: ticketTypes.reduce((n, type) => n + type.ticketCount, 0),
    reservedValue: ticketTypes
      .reduce((n, type) => n.plus(type.reservedValue), new Prisma.Decimal(0))
      .toFixed(2),
    ticketTypes,
  };
}
export async function eventAttendees(
  eventId: string,
  principal: Principal,
  page: number,
  pageSize: number,
) {
  await ownedEvent(eventId, principal);
  return {
    ...(await reportingModel.attendees(
      eventId,
      (page - 1) * pageSize,
      pageSize,
    )),
    page,
    pageSize,
  };
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function attendeeExport(eventId: string, principal: Principal) {
  await ownedEvent(eventId, principal);
  return exportRows(eventId);
}
async function* exportRows(eventId: string) {
  yield [
    "Ticket reference",
    "Buyer name",
    "Buyer email",
    "Ticket type",
    "Ticket status",
    "Reservation status",
    "Unit price",
    "Reserved at",
    "Checked in at",
  ]
    .map(csvCell)
    .join(",") + "\r\n";
  let cursor: string | undefined;
  while (true) {
    const tickets = await reportingModel.exportBatch(eventId, cursor);
    for (const ticket of tickets)
      yield [
        ticket.publicId,
        ticket.reservation.buyerName,
        ticket.reservation.buyerEmail,
        ticket.ticketType.name,
        ticket.status,
        ticket.reservation.status,
        ticket.unitPrice.toFixed(2),
        ticket.createdAt.toISOString(),
        ticket.checkIn?.checkedInAt.toISOString(),
      ]
        .map(csvCell)
        .join(",") + "\r\n";
    if (tickets.length < 500) break;
    cursor = tickets.at(-1)!.id;
  }
}
