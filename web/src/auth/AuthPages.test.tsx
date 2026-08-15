import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SessionContext, type SessionContextValue } from './session-context';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

describe('authentication pages', () => {
  it('validates login fields and restores a safe return path', async () => {
    const login = vi.fn(async () => undefined);
    const router = renderAuth(<LoginPage />, '/login?returnTo=%2Ftickets', { ...anonymousSession, login });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/tickets');
  });

  it('shows registration validation without discarding entered values', async () => {
    renderAuth(<RegisterPage />, '/register', anonymousSession);
    await userEvent.type(screen.getByLabelText('Full name'), 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada');
  });
});

function renderAuth(element: React.ReactNode, entry: string, session: SessionContextValue) {
  const router = createMemoryRouter([{ path: '/login', element }, { path: '/register', element }, { path: '/tickets', element: <h1>Tickets</h1> }], { initialEntries: [entry] });
  render(<SessionContext.Provider value={session}><RouterProvider router={router} /></SessionContext.Provider>);
  return router;
}

const anonymousSession: SessionContextValue = { status: 'anonymous', user: null, login: async () => undefined, register: async () => undefined, logout: async () => undefined };
