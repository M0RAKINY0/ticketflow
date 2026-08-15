import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SessionContext, type SessionContextValue } from '../../auth/session-context';
import { eventFixture } from '../../test/event-fixture';
import { server } from '../../test/server';
import { DiscoveryPage } from './DiscoveryPage';

describe('DiscoveryPage', () => {
  it('owns discovery filters in the URL and maps them to the API request', async () => {
    let requested = '';
    server.use(http.get('/api/v1/events', ({ request }) => {
      requested = request.url;
      return HttpResponse.json({ data: { items: [eventFixture], page: 2, pageSize: 12, total: 13 } });
    }));

    renderPage('/?q=jazz&category=MUSIC&country=NG&page=2');

    expect(await screen.findByRole('heading', { name: 'Lagos After Dark' })).toBeInTheDocument();
    expect(requested).toContain('query=jazz');
    expect(requested).toContain('category=MUSIC');
    expect(requested).toContain('countryCode=NG');
    expect(requested).toContain('page=2');
    expect(screen.getByText(/NGN|₦/)).toBeInTheDocument();
  });

  it('shows a useful empty result instead of a blank grid', async () => {
    server.use(http.get('/api/v1/events', () => HttpResponse.json({ data: { items: [], page: 1, pageSize: 12, total: 0 } })));
    renderPage('/?q=impossible');
    expect(await screen.findByRole('heading', { name: 'No events match yet' })).toBeInTheDocument();
  });
});

function renderPage(entry: string) {
  const router = createMemoryRouter([{ path: '/', element: <DiscoveryPage /> }], { initialEntries: [entry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SessionContext.Provider value={anonymousSession}>
      <QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>
    </SessionContext.Provider>,
  );
}

const anonymousSession: SessionContextValue = { status: 'anonymous', user: null, login: async () => undefined, register: async () => undefined, logout: async () => undefined };
