import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/infrastructure/prisma.js';
import { signAccessToken } from '../../src/utilities/token.js';

const USER_TEST_PREFIX = 'user-list-test-';

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: USER_TEST_PREFIX } },
  });
});

async function createUser(label: string, role: 'USER' | 'ORGANIZER' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email: `${USER_TEST_PREFIX}${label}@example.com`,
      name: `${label} account`,
      phoneNumber: '+2348000000000',
      passwordHash: 'unused-user-list-hash',
      role,
    },
  });

  return { user, token: signAccessToken(user) };
}

describe('admin user listing', () => {
  it('searches and paginates public user fields for admins only', async () => {
    const admin = await createUser('admin', 'ADMIN');
    const member = await createUser('ada-member', 'USER');
    await createUser('other-organizer', 'ORGANIZER');

    const response = await request(createApp())
      .get('/api/v1/users')
      .query({ query: 'ADA', role: 'USER', page: 1, pageSize: 1 })
      .set('Authorization', `Bearer ${admin.token}`);
    const forbidden = await request(createApp())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${member.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
    });
    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: 'USER',
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid pagination and role filters', async () => {
    const admin = await createUser('validation-admin', 'ADMIN');

    const oversized = await request(createApp())
      .get('/api/v1/users')
      .query({ pageSize: 101 })
      .set('Authorization', `Bearer ${admin.token}`);
    const invalidRole = await request(createApp())
      .get('/api/v1/users')
      .query({ role: 'OWNER' })
      .set('Authorization', `Bearer ${admin.token}`);

    expect(oversized.status).toBe(400);
    expect(invalidRole.status).toBe(400);
  });
});
