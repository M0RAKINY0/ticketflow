import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
import { prisma } from '../../src/infrastructure/prisma.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from '../../src/utilities/token.js';

const TOKEN_TEST_EMAIL_PREFIX = 'token-test-';

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TOKEN_TEST_EMAIL_PREFIX } },
  });
});

describe('token utilities', () => {
  it('signs a 15-minute access token with the user subject and role', () => {
    const accessToken = signAccessToken({ id: '1e4486b5-9d96-4e34-a306-12b01197c6a5', role: 'USER' });
    const payload = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET) as jwt.JwtPayload;

    expect(payload.sub).toBe('1e4486b5-9d96-4e34-a306-12b01197c6a5');
    expect(payload.role).toBe('USER');
    expect(payload.exp).toBeDefined();
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(15 * 60);
  });

  it('rotates a refresh token once and rejects its reuse', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${TOKEN_TEST_EMAIL_PREFIX}rotation@example.com`,
        name: 'Token Rotation',
        phoneNumber: '+2348000000001',
        passwordHash: 'not-used-by-this-test',
      },
    });

    const first = await issueRefreshToken(user.id);
    const second = await rotateRefreshToken(first.rawToken);
    const storedFirst = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: createHash('sha256').update(first.rawToken).digest('hex') },
    });

    expect(second.rawToken).not.toBe(first.rawToken);
    expect(storedFirst.revokedAt).not.toBeNull();
    await expect(rotateRefreshToken(first.rawToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects expired and revoked refresh tokens', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${TOKEN_TEST_EMAIL_PREFIX}invalid@example.com`,
        name: 'Invalid Tokens',
        phoneNumber: '+2348000000002',
        passwordHash: 'not-used-by-this-test',
      },
    });
    const expiredRawToken = 'expired-token';
    const revokedRawToken = 'revoked-token';

    await prisma.refreshToken.createMany({
      data: [
        {
          userId: user.id,
          tokenHash: createHash('sha256').update(expiredRawToken).digest('hex'),
          expiresAt: new Date(Date.now() - 1_000),
        },
        {
          userId: user.id,
          tokenHash: createHash('sha256').update(revokedRawToken).digest('hex'),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: new Date(),
        },
      ],
    });

    await expect(rotateRefreshToken(expiredRawToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateRefreshToken(revokedRawToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});
