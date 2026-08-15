import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SessionContext, type SessionContextValue } from '../../auth/session-context';
import { server } from '../../test/server';
import { eventFixture } from '../../test/event-fixture';
import { EventDetailPage } from './EventDetailPage';

describe('EventDetailPage', () => {
  it('renders event-local details and reuses one idempotency key when a reservation is retried', async () => {
    const keys: string[] = [];
    let attempts = 0;
    server.use(
      http.get(`/api/v1/events/${eventFixture.id}`, () => HttpResponse.json({ data: { event: eventFixture } })),
      http.post(`/api/v1/events/${eventFixture.id}/reservations`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: { code: 'TEMPORARY', message: 'Try again' } }, { status: 503 })
          : HttpResponse.json({ data: { reservation: { id: 'reservation-1' } } }, { status: 201 });
      }),
    );

    renderDetail(authenticatedSession);
    expect(await screen.findByRole('heading', { name: 'Lagos After Dark' })).toBeInTheDocument();
    expect(screen.getByText(/Africa\/Lagos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reserve General' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    await userEvent.click(screen.getByRole('button', { name: 'Try reservation again' }));
    expect(await screen.findByRole('heading', { name: 'Reservation confirmed' })).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('sends anonymous attendees to sign in with the event return path', async () => {
    server.use(http.get(`/api/v1/events/${eventFixture.id}`, () => HttpResponse.json({ data: { event: eventFixture } })));
    const router = renderDetail(anonymousSession);
    await screen.findByRole('heading', { name: 'Lagos After Dark' });
    await userEvent.click(screen.getByRole('link', { name: 'Sign in to reserve' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toContain('returnTo=');
  });
});

function renderDetail(session: SessionContextValue) {
  const router = createMemoryRouter([
    { path: '/events/:eventId', element: <EventDetailPage /> },
    { path: '/login', element: <h1>Login</h1> },
    { path: '/tickets', element: <h1>Reservation confirmed</h1> },
  ], { initialEntries: [`/events/${eventFixture.id}`] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<SessionContext.Provider value={session}><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></SessionContext.Provider>);
  return router;
}

const anonymousSession: SessionContextValue = { status: 'anonymous', user: null, login: async () => undefined, register: async () => undefined, logout: async () => undefined };
const authenticatedSession: SessionContextValue = { ...anonymousSession, status: 'authenticated', user: { id: 'user-1', email: 'ada@example.com', name: 'Ada', phoneNumber: '+2348000000000', role: 'USER', createdAt: '', updatedAt: '' } };
