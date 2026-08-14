import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../src/config/env.js';
import { prisma } from '../../src/infrastructure/prisma.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
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
    expect(jwt.decode(accessToken, { complete: true })?.header.alg).toBe('HS256');
  });

  it('rejects a correctly signed access token with no expiry', () => {
    const accessToken = jwt.sign({ role: 'USER' }, env.ACCESS_TOKEN_SECRET, {
      subject: '1e4486b5-9d96-4e34-a306-12b01197c6a5',
      algorithm: 'HS256',
    });

    expect(() => verifyAccessToken(accessToken)).toThrow(/invalid access token/i);
  });

  it('rejects a correctly signed access token that uses HS512', () => {
    const accessToken = jwt.sign({ role: 'USER' }, env.ACCESS_TOKEN_SECRET, {
      subject: '1e4486b5-9d96-4e34-a306-12b01197c6a5',
      algorithm: 'HS512',
      expiresIn: '15m',
    });

    expect(() => verifyAccessToken(accessToken)).toThrow(/invalid access token/i);
  });

  it('rejects a correctly signed access token with the wrong lifetime', () => {
    const accessToken = jwt.sign({ role: 'USER' }, env.ACCESS_TOKEN_SECRET, {
      subject: '1e4486b5-9d96-4e34-a306-12b01197c6a5',
      algorithm: 'HS256',
      expiresIn: '10m',
    });

    expect(() => verifyAccessToken(accessToken)).toThrow(/invalid access token/i);
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

    const issuedAt = Date.UTC(2030, 0, 1, 0, 0, 0);
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(issuedAt);
    const first = await issueRefreshToken(user.id);
    const storedFirst = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: createHash('sha256').update(first.rawToken).digest('hex') },
    });
    dateNow.mockRestore();
    const second = await rotateRefreshToken(first.rawToken);
    const rotatedFirst = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: createHash('sha256').update(first.rawToken).digest('hex') },
    });

    expect(second.rawToken).not.toBe(first.rawToken);
    expect(storedFirst.tokenHash).not.toBe(first.rawToken);
    expect(storedFirst.expiresAt).toEqual(new Date(issuedAt + (30 * 24 * 60 * 60 * 1_000)));
    expect(rotatedFirst.revokedAt).not.toBeNull();
    await expect(rotateRefreshToken(first.rawToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('allows exactly one simultaneous rotation and persists only its replacement', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${TOKEN_TEST_EMAIL_PREFIX}simultaneous@example.com`,
        name: 'Simultaneous Rotation',
        phoneNumber: '+2348000000005',
        passwordHash: 'not-used-by-this-test',
      },
    });
    const first = await issueRefreshToken(user.id);

    const results = await Promise.allSettled([
      rotateRefreshToken(first.rawToken),
      rotateRefreshToken(first.rawToken),
    ]);
    const storedTokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(storedTokens).toHaveLength(2);
    expect(storedTokens.filter((token) => token.revokedAt === null)).toHaveLength(1);
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
