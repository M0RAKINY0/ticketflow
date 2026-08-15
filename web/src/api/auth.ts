import { apiRequest, refreshSession } from './client';
import { setAccessToken } from './token-store';
import type { AuthSession } from './types';

export type LoginInput = { email: string; password: string };
export type RegisterInput = {
  email: string;
  name: string;
  phoneNumber: string;
  password: string;
};

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    authRetry: false,
  });
  setAccessToken(session.accessToken);
  return session;
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const session = await apiRequest<AuthSession>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    authRetry: false,
  });
  setAccessToken(session.accessToken);
  return session;
}

export function bootstrapSession(): Promise<AuthSession> {
  return refreshSession();
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/api/v1/auth/logout', {
      method: 'POST',
      authRetry: false,
    });
  } finally {
    setAccessToken(null);
  }
}
