import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/prisma.js';

const AUTH_TEST_EMAIL_PREFIX = 'auth-test-';
const password = 'Correct-Horse-42';

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: AUTH_TEST_EMAIL_PREFIX } },
  });
});

async function registerUser(email: string) {
  return request(createApp()).post('/api/v1/auth/register').send({
    email,
    name: 'Guest User',
    phoneNumber: '+2348000000000',
    password,
    role: 'ADMIN',
  });
}

describe('authentication and role authorization', () => {
  it('ignores a role supplied by a public registrant and never returns the password hash', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}guest@example.com`;
    const response = await registerUser(email);
    const storedUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('USER');
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).toHaveProperty('refreshToken');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(await bcrypt.getRounds(storedUser.passwordHash)).toBe(12);
  });

  it('returns 401 for invalid credentials', async () => {
    await registerUser(`${AUTH_TEST_EMAIL_PREFIX}bad-login@example.com`);

    const response = await request(createApp()).post('/api/v1/auth/login').send({
      email: `${AUTH_TEST_EMAIL_PREFIX}bad-login@example.com`,
      password: 'not-the-right-password',
    });

    expect(response.status).toBe(401);
  });

  it('rotates refresh tokens and rejects a reused token', async () => {
    const registration = await registerUser(`${AUTH_TEST_EMAIL_PREFIX}refresh@example.com`);
    const firstRefreshToken = registration.body.data.refreshToken as string;

    const refreshed = await request(createApp()).post('/api/v1/auth/refresh').send({
      refreshToken: firstRefreshToken,
    });
    const reused = await request(createApp()).post('/api/v1/auth/refresh').send({
      refreshToken: firstRefreshToken,
    });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(firstRefreshToken);
    expect(reused.status).toBe(401);
  });

  it('authenticates profile requests and revokes refresh tokens on logout', async () => {
    const registration = await registerUser(`${AUTH_TEST_EMAIL_PREFIX}profile@example.com`);
    const { accessToken, refreshToken } = registration.body.data as {
      accessToken: string;
      refreshToken: string;
    };

    const unauthenticated = await request(createApp()).get('/api/v1/me');
    const profile = await request(createApp())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    const logout = await request(createApp()).post('/api/v1/auth/logout').send({ refreshToken });
    const refreshed = await request(createApp()).post('/api/v1/auth/refresh').send({ refreshToken });

    expect(unauthenticated.status).toBe(401);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe(`${AUTH_TEST_EMAIL_PREFIX}profile@example.com`);
    expect(logout.status).toBe(204);
    expect(refreshed.status).toBe(401);
  });

  it('allows only admins to assign USER or ORGANIZER roles', async () => {
    const target = await prisma.user.create({
      data: {
        email: `${AUTH_TEST_EMAIL_PREFIX}target@example.com`,
        name: 'Target User',
        phoneNumber: '+2348000000003',
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    await prisma.user.create({
      data: {
        email: `${AUTH_TEST_EMAIL_PREFIX}admin@example.com`,
        name: 'Admin User',
        phoneNumber: '+2348000000004',
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
      },
    });
    const userRegistration = await registerUser(`${AUTH_TEST_EMAIL_PREFIX}member@example.com`);
    const adminLogin = await request(createApp()).post('/api/v1/auth/login').send({
      email: `${AUTH_TEST_EMAIL_PREFIX}admin@example.com`,
      password,
    });

    const forbidden = await request(createApp())
      .patch(`/api/v1/users/${target.id}/role`)
      .set('Authorization', `Bearer ${userRegistration.body.data.accessToken}`)
      .send({ role: 'ORGANIZER' });
    const changed = await request(createApp())
      .patch(`/api/v1/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`)
      .send({ role: 'ORGANIZER' });
    const adminRole = await request(createApp())
      .patch(`/api/v1/users/${target.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`)
      .send({ role: 'ADMIN' });

    expect(forbidden.status).toBe(403);
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.role).toBe('ORGANIZER');
    expect(adminRole.status).toBe(400);
  });
});
