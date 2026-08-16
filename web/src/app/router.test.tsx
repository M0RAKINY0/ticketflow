import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { SessionContext, type SessionContextValue } from '../auth/session-context';
import { appRoutes } from './router';

describe('Ventra router', () => {
  it('renders the public discovery shell with accessible primary navigation', async () => {
    renderRouter(['/'], anonymousSession);

    expect(await screen.findByRole('link', { name: 'Ventra home' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find something worth showing up for.' })).toBeInTheDocument();
  });

  it('preserves the internal destination when a protected route redirects to sign in', async () => {
    const router = renderRouter(['/tickets'], anonymousSession);

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?returnTo=%2Ftickets');
  });

  it('shows Create event and allows a signed-in user into event management', async () => {
    renderRouter(['/organizer/events'], authenticatedUserSession);

    expect(await screen.findByRole('link', { name: 'Create event' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your events' })).toBeInTheDocument();
  });
});

function renderRouter(entries: string[], session: SessionContextValue) {
  const router = createMemoryRouter(appRoutes, { initialEntries: entries });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <SessionContext.Provider value={session}>
      <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
    </SessionContext.Provider>,
  );
  return router;
}

const anonymousSession: SessionContextValue = {
  status: 'anonymous',
  user: null,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
};

const authenticatedUserSession: SessionContextValue = {
  ...anonymousSession,
  status: 'authenticated',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ada@example.com',
    name: 'Ada User',
    phoneNumber: '+2348000000000',
    role: 'USER',
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  },
};
