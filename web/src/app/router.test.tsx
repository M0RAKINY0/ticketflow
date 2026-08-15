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
});

function renderRouter(entries: string[], session: SessionContextValue) {
  const router = createMemoryRouter(appRoutes, { initialEntries: entries });
  render(
    <SessionContext.Provider value={session}>
      <RouterProvider router={router} />
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
