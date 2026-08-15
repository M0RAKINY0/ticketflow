import type { CookieOptions } from 'express';

export const refreshCookieName = 'ventra_refresh';

export function refreshCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1_000,
  };
}
