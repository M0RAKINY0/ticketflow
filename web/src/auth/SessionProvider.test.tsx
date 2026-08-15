import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';

import { SessionProvider, useSession } from './SessionProvider';
import { getAccessToken } from '../api/token-store';
import { server } from '../test/server';

describe('SessionProvider', () => {
  it('bootstraps an authenticated session from the refresh cookie', async () => {
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ data: { accessToken: 'bootstrap-access', user: userFixture } }),
      ),
    );

    render(<SessionProbe />, { wrapper: createWrapper() });

    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
    expect(await screen.findByText('Ada User')).toBeInTheDocument();
    expect(getAccessToken()).toBe('bootstrap-access');
  });

  it('settles as anonymous when no refresh cookie exists', async () => {
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' } },
          { status: 401 },
        ),
      ),
    );

    render(<SessionProbe />, { wrapper: createWrapper() });

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it('logs out, clears query data, and drops the in-memory token', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['private'], { secret: true });
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ data: { accessToken: 'active-access', user: userFixture } }),
      ),
      http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('Ada User');

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(screen.getByText('Signed out')).toBeInTheDocument());
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
    expect(getAccessToken()).toBeNull();
  });
});

function SessionProbe() {
  const session = useSession();
  if (session.status === 'loading') return <p>Checking your session…</p>;
  if (session.status === 'anonymous') return <p>Signed out</p>;
  return (
    <div>
      <p>{session.user.name}</p>
      <button type="button" onClick={() => void session.logout()}>
        Log out
      </button>
    </div>
  );
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  };
}

const userFixture = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  name: 'Ada User',
  phoneNumber: '+2348000000000',
  role: 'USER' as const,
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};
