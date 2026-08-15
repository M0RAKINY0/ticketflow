import { apiRequest } from '../../api/client';
import type { DiscoveryFilters, EventPage, VentraEvent } from './event-types';
import { eventQueryString } from './filters';

export function listEvents(filters: DiscoveryFilters) {
  return apiRequest<EventPage>(`/api/v1/events?${eventQueryString(filters)}`);
}

export async function getEvent(eventId: string) {
  return (await apiRequest<{ event: VentraEvent }>(`/api/v1/events/${eventId}`)).event;
}

export async function reserveTicket(eventId: string, ticketTypeId: string, key: string) {
  return (await apiRequest<{ reservation: { id: string } }>(`/api/v1/events/${eventId}/reservations`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ ticketTypeId }),
  })).reservation;
}
