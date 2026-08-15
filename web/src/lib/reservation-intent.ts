export type ReservationIntent = { eventId: string; ticketTypeId: string; key: string };

export function getReservationKey(current: ReservationIntent | null, eventId: string, ticketTypeId: string): ReservationIntent {
  if (current?.eventId === eventId && current.ticketTypeId === ticketTypeId) return current;
  return { eventId, ticketTypeId, key: crypto.randomUUID() };
}
