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

function refreshCookie(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) throw new Error('Expected a refresh cookie');
  return value.split(';', 1)[0]!;
}

describe('authentication and role authorization', () => {
  it('ignores a role supplied by a public registrant and never returns the password hash', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}guest@example.com`;
    const response = await registerUser(email);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('USER');
    expect(response.body.data).toHaveProperty('accessToken');
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']?.[0]).toContain('ventra_refresh=');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie']?.[0]).toContain('Path=/api/v1/auth');
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=2592000');
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(await bcrypt.getRounds(storedUser.passwordHash)).toBe(12);
  });

  it('returns 401 for invalid credentials', async () => {
    await registerUser(`${AUTH_TEST_EMAIL_PREFIX}bad-login@example.com`);

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
        email: `${AUTH_TEST_EMAIL_PREFIX}bad-login@example.com`,
        password: 'not-the-right-password',
      });

    expect(response.status).toBe(401);
  });

  it('does not expose a password hash from a successful login', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}login@example.com`;
    await registerUser(email);

    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('rotates refresh tokens and rejects a reused token', async () => {
    const registration = await registerUser(
      `${AUTH_TEST_EMAIL_PREFIX}refresh@example.com`,
    );
    const firstRefreshCookie = refreshCookie(registration);

    const refreshed = await request(createApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefreshCookie)
      .send();
    const secondRefreshCookie = refreshCookie(refreshed);
    const reused = await request(createApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefreshCookie)
      .send();

    expect(refreshed.status).toBe(200);
    expect(secondRefreshCookie).not.toBe(firstRefreshCookie);
    expect(refreshed.body.data).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(refreshed.body)).not.toContain('passwordHash');
    expect(reused.status).toBe(401);
  });

  it('rejects refresh without a valid cookie', async () => {
    const missing = await request(createApp())
      .post('/api/v1/auth/refresh')
      .send();
    const invalid = await request(createApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'ventra_refresh=invalid')
      .send();

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it('authenticates profile requests and revokes refresh tokens on logout', async () => {
    const registration = await registerUser(
      `${AUTH_TEST_EMAIL_PREFIX}profile@example.com`,
    );
    const { accessToken } = registration.body.data as { accessToken: string };
    const cookie = refreshCookie(registration);

    const unauthenticated = await request(createApp()).get('/api/v1/me');
    const profile = await request(createApp())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    const logout = await request(createApp())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .send();
    const refreshed = await request(createApp())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .send();

    expect(unauthenticated.status).toBe(401);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user.email).toBe(
      `${AUTH_TEST_EMAIL_PREFIX}profile@example.com`,
    );
    expect(JSON.stringify(profile.body)).not.toContain('passwordHash');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('ventra_refresh=;');
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
    const userRegistration = await registerUser(
      `${AUTH_TEST_EMAIL_PREFIX}member@example.com`,
    );
    const adminLogin = await request(createApp())
      .post('/api/v1/auth/login')
      .send({
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
    expect(JSON.stringify(changed.body)).not.toContain('passwordHash');
    expect(adminRole.status).toBe(400);
  });

  it('maps malformed JSON to a stable 400 error without parser internals', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
    });
  });

  it('maps oversized JSON to a stable 413 error without parser internals', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ email: 'x'.repeat(110_000) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body is too large',
      },
    });
  });

  it('returns a conflict for one of two simultaneous registrations with the same email', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}duplicate@example.com`;

    const responses = await Promise.all([
      registerUser(email),
      registerUser(email),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(responses.find((response) => response.status === 409)?.body).toEqual(
      {
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered',
        },
      },
    );
  });
});
