import { openDB, type DBSchema } from 'idb';

export type OfflineTicketRecord = {
  userId: string; ticketId: string; publicId: string; status: 'PENDING' | 'READY' | 'USED' | 'VOID';
  qrPayload: string; qrCodeDataUrl: string; eventTitle: string; ticketTypeName: string; startsAt: string;
  timezone: string; venue: string; city: string; countryCode: string; cachedAt: string;
};

interface VentraDb extends DBSchema {
  tickets: {
    key: [string, string];
    value: OfflineTicketRecord;
    indexes: { 'by-user': string };
  };
}

const database = openDB<VentraDb>('ventra', 1, {
  upgrade(db) {
    const tickets = db.createObjectStore('tickets', { keyPath: ['userId', 'ticketId'] });
    tickets.createIndex('by-user', 'userId');
  },
});

export async function putOfflineTicket(ticket: OfflineTicketRecord): Promise<void> {
  await (await database).put('tickets', ticket);
}

export async function getOfflineTicket(userId: string, ticketId: string): Promise<OfflineTicketRecord | undefined> {
  return (await database).get('tickets', [userId, ticketId]);
}

export async function listOfflineTickets(userId: string): Promise<OfflineTicketRecord[]> {
  return (await database).getAllFromIndex('tickets', 'by-user', userId);
}

export async function deleteOfflineTicketsForUser(userId: string): Promise<void> {
  const db = await database;
  const transaction = db.transaction('tickets', 'readwrite');
  let cursor = await transaction.store.index('by-user').openKeyCursor(userId);
  while (cursor) {
    await transaction.store.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }
  await transaction.done;
}
