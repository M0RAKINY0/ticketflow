import { afterEach, describe, expect, it } from 'vitest';

import { deleteOfflineTicketsForUser, getOfflineTicket, listOfflineTickets, putOfflineTicket } from './offline-tickets';

describe('offline tickets', () => {
  afterEach(async () => { await deleteOfflineTicketsForUser('user-a'); await deleteOfflineTicketsForUser('user-b'); });

  it('stores tickets by user and refuses cross-user reads', async () => {
    await putOfflineTicket(record);
    expect(await getOfflineTicket('user-a', 'ticket-1')).toMatchObject({ publicId: 'VT-123', qrPayload: 'signed-value' });
    expect(await getOfflineTicket('user-b', 'ticket-1')).toBeUndefined();
    expect(await listOfflineTickets('user-a')).toHaveLength(1);
  });

  it('purges only the signed ticket data belonging to the user', async () => {
    await putOfflineTicket(record);
    await putOfflineTicket({ ...record, userId: 'user-b' });
    await deleteOfflineTicketsForUser('user-a');
    expect(await listOfflineTickets('user-a')).toEqual([]);
    expect(await listOfflineTickets('user-b')).toHaveLength(1);
  });
});

const record = { userId: 'user-a', ticketId: 'ticket-1', publicId: 'VT-123', status: 'READY' as const, qrPayload: 'signed-value', qrCodeDataUrl: 'data:image/png;base64,abc', eventTitle: 'Lagos After Dark', ticketTypeName: 'General', startsAt: '2026-09-20T18:00:00.000Z', timezone: 'Africa/Lagos', venue: 'Civic Centre', city: 'Lagos', countryCode: 'NG', cachedAt: '2026-08-16T00:00:00.000Z' };
