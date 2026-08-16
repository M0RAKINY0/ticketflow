import type { Role } from '../../generated/prisma/client.js';

export type EventPrincipal = { id: string; role: Role };

export function canManageEvent(principal: EventPrincipal, ownerId: string): boolean {
  return principal.role === 'ADMIN' || principal.id === ownerId;
}
