import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../lib/currency';
import { getReservationKey, type ReservationIntent } from '../../lib/reservation-intent';
import { reserveTicket } from './event-api';
import type { VentraEvent } from './event-types';

export function ReservationPanel({ event }: { event: VentraEvent }) {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const intent = useRef<ReservationIntent | null>(null);
  const [selectedId, setSelectedId] = useState(event.ticketTypes[0]?.id ?? '');
  const selected = event.ticketTypes.find((ticket) => ticket.id === selectedId);
  const reservation = useMutation({ mutationFn: async () => {
    if (!selected) throw new Error('Choose a ticket type');
    intent.current = getReservationKey(intent.current, event.id, selected.id);
    return reserveTicket(event.id, selected.id, intent.current.key);
  }, onSuccess: () => void navigate('/tickets') });
  const available = selected ? selected.reservedCount < selected.capacity : false;

  return <aside className="reservation-panel" aria-labelledby="tickets-title"><h2 id="tickets-title">Choose your ticket</h2><div className="ticket-options">{event.ticketTypes.map((ticket) => { const soldOut = ticket.reservedCount >= ticket.capacity; return <label className={`ticket-option ${selectedId === ticket.id ? 'selected' : ''}`} key={ticket.id}><input type="radio" name="ticketType" value={ticket.id} checked={selectedId === ticket.id} disabled={soldOut} onChange={() => { setSelectedId(ticket.id); intent.current = null; reservation.reset(); }} /><span><strong>{ticket.name}</strong><small>{soldOut ? 'Sold out' : `${ticket.capacity - ticket.reservedCount} remaining`}</small></span><b>{formatCurrency(ticket.price, event.currency)}</b></label>; })}</div>
    {session.status === 'authenticated' ? <Button className="reservation-action" size="lg" disabled={!available || reservation.isPending} onClick={() => reservation.mutate()}>{reservation.isPending ? 'Reserving…' : `Reserve ${selected?.name ?? 'ticket'}`}</Button> : <Link className="button button--primary reservation-action" to={`/login?returnTo=${encodeURIComponent(location.pathname)}`}>Sign in to reserve</Link>}
    {reservation.isError ? <div className="reservation-error" role="alert"><p>{reservation.error instanceof ApiError ? reservation.error.message : 'Could not reserve this ticket.'}</p><Button variant="secondary" onClick={() => reservation.mutate()}>Try reservation again</Button></div> : null}
  </aside>;
}
