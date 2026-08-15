import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RequireRole, RequireUser, safeReturnTo } from './guards';
import { SessionContext, type SessionContextValue } from './session-context';

describe('route guards', () => {
  it('preserves an internal intended route for anonymous users', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireUser />,
          children: [{ path: '/tickets', element: <p>Tickets</p> }],
        },
        { path: '/login', element: <p>Login</p> },
      ],
      { initialEntries: ['/tickets?view=current'] },
    );

    render(
      <SessionContext.Provider value={anonymousSession}>
        <RouterProvider router={router} />
      </SessionContext.Provider>,
    );

    expect(await screen.findByText('Login')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?returnTo=%2Ftickets%3Fview%3Dcurrent');
  });

  it('blocks authenticated users without the required role', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireRole roles={['ORGANIZER']} />,
          children: [{ path: '/organizer', element: <Outlet /> }],
        },
        { path: '/', element: <p>Discover</p> },
      ],
      { initialEntries: ['/organizer'] },
    );

    render(
      <SessionContext.Provider value={authenticatedUserSession}>
        <RouterProvider router={router} />
      </SessionContext.Provider>,
    );

    expect(await screen.findByText('Discover')).toBeInTheDocument();
  });

  it('rejects external return targets', () => {
    expect(safeReturnTo('//malicious.example')).toBe('/');
    expect(safeReturnTo('https://malicious.example')).toBe('/');
    expect(safeReturnTo('/events/123')).toBe('/events/123');
  });
});

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
