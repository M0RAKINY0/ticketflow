import { getAccessToken, setAccessToken } from './token-store';
import type { ApiErrorBody, AuthSession } from './types';

type ApiRequestOptions = RequestInit & { authRetry?: boolean };

let refreshPromise: Promise<AuthSession> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { authRetry = true, ...init } = options;
  const response = await send(path, init, getAccessToken());

  if (response.status !== 401 || !authRetry || path === '/api/v1/auth/refresh') {
    return unwrap<T>(response);
  }

  await refreshSessionOnce();
  return unwrap<T>(await send(path, init, getAccessToken()));
}

export async function refreshSession(): Promise<AuthSession> {
  try {
    const response = await send('/api/v1/auth/refresh', { method: 'POST' }, null);
    const session = await unwrap<AuthSession>(response);
    setAccessToken(session.accessToken);
    return session;
  } catch (error) {
    setAccessToken(null);
    throw error;
  }
}

export function refreshSessionOnce(): Promise<AuthSession> {
  refreshPromise ??= refreshSession().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function send(
  path: string,
  init: RequestInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as
    | { data: T }
    | { error: ApiErrorBody };

  if (!response.ok || 'error' in payload) {
    const body = 'error' in payload
      ? payload.error
      : { code: 'REQUEST_FAILED', message: 'The request could not be completed' };
    throw new ApiError(response.status, body.code, body.message, body.details);
  }

  return payload.data;
}
