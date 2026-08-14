import { createHash, randomBytes, randomUUID } from 'node:crypto';

import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env.js';
import { prisma } from '../infrastructure/prisma.js';
import type { Role } from '../generated/prisma/client.js';
import { AppError } from '../shared/errors.js';

const ACCESS_TOKEN_LIFETIME = '15m';
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;

type AccessTokenUser = {
  id: string;
  role: Role;
};

export type RefreshTokenResult = {
  rawToken: string;
  user: AccessTokenUser;
};

export type AccessTokenClaims = {
  sub: string;
  role: Role;
};

function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function createRawRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function signAccessToken(user: AccessTokenUser): string {
  return jwt.sign({ role: user.role }, env.ACCESS_TOKEN_SECRET, {
    subject: user.id,
    expiresIn: ACCESS_TOKEN_LIFETIME,
  });
}

export function verifyAccessToken(accessToken: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(accessToken, env.ACCESS_TOKEN_SECRET) as JwtPayload;

    if (typeof payload.sub !== 'string' || !isRole(payload.role)) {
      throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Invalid access token');
    }

    return { sub: payload.sub, role: payload.role };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Invalid access token');
  }
}

export async function issueRefreshToken(userId: string): Promise<RefreshTokenResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const rawToken = createRawRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
    },
  });

  return { rawToken, user };
}

export async function rotateRefreshToken(rawToken: string): Promise<RefreshTokenResult> {
  const tokenHash = hashRefreshToken(rawToken);

  return prisma.$transaction(async (transaction) => {
    const previousToken = await transaction.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!previousToken || previousToken.revokedAt || previousToken.expiresAt <= new Date()) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    const nextRawToken = createRawRefreshToken();
    const nextTokenId = randomUUID();
    const now = new Date();

    await transaction.refreshToken.create({
      data: {
        id: nextTokenId,
        userId: previousToken.userId,
        tokenHash: hashRefreshToken(nextRawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
      },
    });

    const revoked = await transaction.refreshToken.updateMany({
      where: {
        id: previousToken.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        replacedById: nextTokenId,
      },
    });

    if (revoked.count !== 1) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    return { rawToken: nextRawToken, user: previousToken.user };
  });
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const revoked = await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashRefreshToken(rawToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  if (revoked.count !== 1) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }
}

function isRole(value: unknown): value is Role {
  return value === 'USER' || value === 'ORGANIZER' || value === 'ADMIN';
}
