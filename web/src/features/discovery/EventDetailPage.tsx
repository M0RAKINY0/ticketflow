import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, UserRound } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { ErrorState, LoadingState } from '../../components/ui/Feedback';
import { formatEventDate } from '../../lib/date-time';
import { EventCover } from './EventCover';
import { getEvent } from './event-api';
import { ReservationPanel } from './ReservationPanel';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => getEvent(eventId), enabled: Boolean(eventId) });
  if (event.isLoading) return <main className="page-width"><LoadingState label="Loading event…" /></main>;
  if (event.isError || !event.data) return <main className="page-width"><ErrorState message="This event could not be loaded." /></main>;
  const item = event.data;
  return <main className="event-detail"><div className="event-detail__cover page-width"><EventCover category={item.category} title={item.title} url={item.coverImageUrl} /></div><div className="event-detail__layout page-width"><article className="event-story"><p className="event-card__date">{item.category.replaceAll('_', ' ')}</p><h1>{item.title}</h1><p className="event-story__lead">{item.description}</p><dl className="event-facts"><div><CalendarDays aria-hidden="true" /><dt>When</dt><dd>{formatEventDate(item.startsAt, item.timezone)}<small>{item.timezone}</small></dd></div><div><MapPin aria-hidden="true" /><dt>Where</dt><dd>{item.venue}<small>{item.city}, {item.countryCode}</small></dd></div><div><UserRound aria-hidden="true" /><dt>Hosted by</dt><dd>{item.organizer.name}</dd></div></dl></article><ReservationPanel event={item} /></div></main>;
}
