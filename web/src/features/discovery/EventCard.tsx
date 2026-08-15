import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatCurrency } from '../../lib/currency';
import { formatEventDate } from '../../lib/date-time';
import { EventCover } from './EventCover';
import type { VentraEvent } from './event-types';

export function EventCard({ event }: { event: VentraEvent }) {
  const available = event.ticketTypes.filter((ticket) => ticket.reservedCount < ticket.capacity);
  const lowest = available.sort((a, b) => Number(a.price) - Number(b.price))[0];
  return <article className="event-card"><Link to={`/events/${event.id}`}><EventCover category={event.category} title={event.title} url={event.coverImageUrl} /><div className="event-card__body"><p className="event-card__date">{formatEventDate(event.startsAt, event.timezone)}</p><h3>{event.title}</h3><p className="event-card__place"><MapPin size={15} aria-hidden="true" />{event.city}, {event.countryCode}</p><p className="event-card__price">{lowest ? `From ${formatCurrency(lowest.price, event.currency)}` : 'Sold out'}</p></div></Link></article>;
}
