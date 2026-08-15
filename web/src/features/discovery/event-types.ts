export type EventCategory = 'MUSIC' | 'BUSINESS' | 'TECHNOLOGY' | 'ARTS_CULTURE' | 'FOOD_DRINK' | 'SPORTS_FITNESS' | 'COMMUNITY' | 'EDUCATION' | 'OTHER';

export type TicketType = {
  id: string; eventId: string; name: string; description: string | null; price: string;
  capacity: number; reservedCount: number; createdAt: string; updatedAt: string;
};

export type VentraEvent = {
  id: string; title: string; description: string; startsAt: string; endsAt: string; venue: string;
  category: EventCategory; coverImageUrl: string | null; city: string; countryCode: string; currency: string;
  timezone: string; status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'; organizerId: string;
  organizer: { id: string; name: string }; ticketTypes: TicketType[]; createdAt: string; updatedAt: string;
};

export type EventPage = { items: VentraEvent[]; page: number; pageSize: number; total: number };
export type DiscoveryFilters = { q?: string; category?: EventCategory; from?: string; to?: string; country?: string; page: number };
