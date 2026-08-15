import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { apiRequest } from './client';
import { getAccessToken, setAccessToken } from './token-store';
import { server } from '../test/server';

afterEach(() => setAccessToken(null));

describe('apiRequest', () => {
  it('uses one refresh for simultaneous unauthorized requests and retries each once', async () => {
    let refreshCount = 0;
    let protectedCount = 0;

    server.use(
      http.get('/api/v1/protected/:id', ({ request }) => {
        protectedCount += 1;
        return request.headers.get('authorization') === 'Bearer renewed-access'
          ? HttpResponse.json({ data: { ok: true } })
          : HttpResponse.json(
              { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
              { status: 401 },
            );
      }),
      http.post('/api/v1/auth/refresh', async () => {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({
          data: {
            accessToken: 'renewed-access',
            user: userFixture,
          },
        });
      }),
    );

    const results = await Promise.all([
      apiRequest<{ ok: boolean }>('/api/v1/protected/one'),
      apiRequest<{ ok: boolean }>('/api/v1/protected/two'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCount).toBe(1);
    expect(protectedCount).toBe(4);
    expect(getAccessToken()).toBe('renewed-access');
  });

  it('clears the access token when refresh fails', async () => {
    setAccessToken('expired-access');
    server.use(
      http.get('/api/v1/protected', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
          { status: 401 },
        ),
      ),
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json(
          { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' } },
          { status: 401 },
        ),
      ),
    );

    await expect(apiRequest('/api/v1/protected')).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
  });
});

const userFixture = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  name: 'Ada User',
  phoneNumber: '+2348000000000',
  role: 'USER' as const,
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};
