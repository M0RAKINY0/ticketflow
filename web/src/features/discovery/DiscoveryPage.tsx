import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/Feedback';
import { EventCard } from './EventCard';
import { listEvents } from './event-api';
import type { EventCategory } from './event-types';
import { readDiscoveryFilters } from './filters';

const categories: Array<[EventCategory, string]> = [['MUSIC', 'Music'], ['BUSINESS', 'Business'], ['TECHNOLOGY', 'Technology'], ['ARTS_CULTURE', 'Arts & culture'], ['FOOD_DRINK', 'Food & drink'], ['SPORTS_FITNESS', 'Sports & fitness'], ['COMMUNITY', 'Community'], ['EDUCATION', 'Education']];

export function DiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readDiscoveryFilters(params), [params]);
  const [search, setSearch] = useState(filters.q ?? '');
  useEffect(() => setSearch(filters.q ?? ''), [filters.q]);
  const events = useQuery({ queryKey: ['events', filters], queryFn: () => listEvents(filters), placeholderData: keepPreviousData });

  function update(name: string, value?: string) {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    next.delete('page');
    setParams(next, { replace: true });
  }
  function submit(event: FormEvent) { event.preventDefault(); update('q', search.trim() || undefined); }

  return <main>
    <section className="discovery-hero"><div className="page-width">
      <p className="hero-note">Events, wherever you are</p>
      <h1>Find something worth <br />showing up for.</h1>
      <p className="hero-copy">Concerts, workshops, dinners and gatherings—curated around the places and people that matter to you.</p>
      <form className="hero-search" role="search" onSubmit={submit}><Search size={22} aria-hidden="true" /><label className="sr-only" htmlFor="event-search">Search events</label><input id="event-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events, cities, or venues" /><button type="submit">Search</button></form>
      <nav className="category-rail" aria-label="Event categories">{categories.map(([value, label]) => <button className={filters.category === value ? 'active' : ''} key={value} type="button" onClick={() => update('category', filters.category === value ? undefined : value)}>{label}</button>)}</nav>
    </div></section>
    <section className="events-section page-width" aria-labelledby="events-heading">
      <div className="section-heading"><div><h2 id="events-heading">What’s happening</h2><p>{filters.q ? `Results for “${filters.q}”` : 'Fresh picks from organizers around the world.'}</p></div></div>
      {events.isLoading ? <LoadingState label="Finding events…" /> : events.isError ? <ErrorState action={<Button variant="secondary" onClick={() => void events.refetch()}>Try again</Button>} /> : !events.data?.items.length ? <EmptyState title="No events match yet" message="Try a different search or clear a filter." action={<Link className="button button--secondary" to="/">Clear filters</Link>} /> : <><div className="event-grid">{events.data.items.map((event) => <EventCard event={event} key={event.id} />)}</div><Pagination page={events.data.page} pageSize={events.data.pageSize} total={events.data.total} onPage={(page) => { const next = new URLSearchParams(params); page > 1 ? next.set('page', String(page)) : next.delete('page'); setParams(next); }} /></>}
    </section>
  </main>;
}

function Pagination({ onPage, page, pageSize, total }: { onPage(page: number): void; page: number; pageSize: number; total: number }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Event pages"><Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button></nav>;
}
