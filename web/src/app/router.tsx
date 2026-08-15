import { Search } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { createBrowserRouter, Link, Navigate, type RouteObject, useNavigate } from 'react-router-dom';

import { AnonymousOnly, RequireRole, RequireUser } from '../auth/guards';
import { AppShell } from '../components/layout/AppShell';

const categories = ['Music', 'Business', 'Technology', 'Arts & culture', 'Food & drink', 'Sports & fitness'];

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DiscoveryFoundation /> },
      { path: 'events/:eventId', element: <RoutePlaceholder title="Event details" /> },
      {
        element: <AnonymousOnly />,
        children: [
          { path: 'login', element: <AuthFoundation /> },
          { path: 'register', element: <AuthFoundation register /> },
        ],
      },
      {
        element: <RequireUser />,
        children: [
          { path: 'tickets', element: <RoutePlaceholder title="My tickets" /> },
          { path: 'account', element: <RoutePlaceholder title="My account" /> },
        ],
      },
      {
        element: <RequireRole roles={['ORGANIZER', 'ADMIN']} />,
        children: [
          { path: 'organizer/events', element: <RoutePlaceholder title="Organizer workspace" /> },
          { path: 'organizer/scan', element: <RoutePlaceholder title="Check in guests" /> },
        ],
      },
      {
        element: <RequireRole roles={['ADMIN']} />,
        children: [{ path: 'admin', element: <RoutePlaceholder title="Administration" /> }],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

function DiscoveryFoundation() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    void navigate(value ? `/?query=${encodeURIComponent(value)}` : '/');
  }
  return (
    <main>
      <section className="discovery-hero">
        <div className="page-width">
          <p className="hero-note">Events, wherever you are</p>
          <h1>Find something worth <br />showing up for.</h1>
          <p className="hero-copy">Concerts, workshops, dinners and gatherings—curated around the places and people that matter to you.</p>
          <form className="hero-search" role="search" onSubmit={submit}>
            <Search size={22} aria-hidden="true" />
            <label className="sr-only" htmlFor="event-search">Search events</label>
            <input id="event-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, cities, or venues" />
            <button type="submit">Search</button>
          </form>
          <nav className="category-rail" aria-label="Event categories">
            {categories.map((category) => <Link key={category} to={`/?category=${encodeURIComponent(category.toUpperCase().replaceAll(' ', '_').replace('&_', ''))}`}>{category}</Link>)}
          </nav>
        </div>
      </section>
      <section className="discovery-preview page-width" aria-labelledby="discovery-heading">
        <div className="section-heading">
          <div><h2 id="discovery-heading">What’s happening</h2><p>Fresh picks from organizers around the world.</p></div>
          <span>Discovery arriving next</span>
        </div>
        <div className="preview-grid" aria-hidden="true">
          <div className="preview-card preview-card--violet"><span>Live</span></div>
          <div className="preview-card preview-card--coral"><span>Gather</span></div>
          <div className="preview-card preview-card--ink"><span>Learn</span></div>
        </div>
      </section>
    </main>
  );
}

function AuthFoundation({ register = false }: { register?: boolean }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="wordmark auth-card__mark" to="/" aria-label="Ventra home">Ventra<span>.</span></Link>
        <h1>{register ? 'Create your account' : 'Welcome back'}</h1>
        <p>{register ? 'Your next great event starts here.' : 'Sign in to see your tickets and events.'}</p>
        <div className="auth-card__pending">The secure sign-in form is the next product layer.</div>
        <Link className="text-link" to={register ? '/login' : '/register'}>{register ? 'Already have an account? Sign in' : 'New to Ventra? Create an account'}</Link>
      </section>
    </main>
  );
}

function RoutePlaceholder({ title }: { title: string }) {
  return <main className="route-placeholder page-width"><h1>{title}</h1><p>This workspace is ready for its next end-to-end product layer.</p><Link className="text-link" to="/">Back to explore</Link></main>;
}
