export const eventFixture = {
  id: '10000000-0000-4000-8000-000000000001', title: 'Lagos After Dark', description: 'An intimate night of live jazz.',
  startsAt: '2026-09-20T18:00:00.000Z', endsAt: '2026-09-20T21:00:00.000Z', venue: 'Civic Centre',
  category: 'MUSIC', coverImageUrl: null, city: 'Lagos', countryCode: 'NG', currency: 'NGN', timezone: 'Africa/Lagos',
  status: 'PUBLISHED', organizerId: '20000000-0000-4000-8000-000000000001', organizer: { id: '20000000-0000-4000-8000-000000000001', name: 'Night House' },
  ticketTypes: [{ id: '30000000-0000-4000-8000-000000000001', eventId: '10000000-0000-4000-8000-000000000001', name: 'General', description: null, price: '15000.00', capacity: 100, reservedCount: 4, createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z' }],
  createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z',
} as const;
