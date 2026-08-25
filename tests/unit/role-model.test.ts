import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { verifyAccessToken } from '../../src/utilities/token.js';

describe('two-account role model', () => {
  it('rejects access tokens carrying the removed Organizer role', () => {
    const legacyToken = jwt.sign(
      { role: 'ORGANIZER' },
      env.ACCESS_TOKEN_SECRET,
      {
        subject: '1e4486b5-9d96-4e34-a306-12b01197c6a5',
        algorithm: 'HS256',
        expiresIn: '15m',
      },
    );

    expect(() => verifyAccessToken(legacyToken)).toThrow(/invalid access token/i);
  });
});
