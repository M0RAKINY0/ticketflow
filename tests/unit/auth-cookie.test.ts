import { describe, expect, it } from 'vitest';

import {
  refreshCookieName,
  refreshCookieOptions,
} from '../../src/modules/auth/auth.cookie.js';

describe('refresh cookie policy', () => {
  it('keeps the refresh credential inaccessible to browser scripts', () => {
    expect(refreshCookieName).toBe('ventra_refresh');
    expect(refreshCookieOptions(false)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/auth',
      maxAge: 2_592_000_000,
    });
  });

  it('requires HTTPS transport in production', () => {
    expect(refreshCookieOptions(true).secure).toBe(true);
  });
});
