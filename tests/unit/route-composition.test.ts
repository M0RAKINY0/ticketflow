import { describe, expect, it } from 'vitest';

import { authRouter } from '../../src/modules/auth/auth.routes.js';
import { ticketingRouter } from '../../src/modules/ticketing/ticketing.routes.js';
import { usersRouter } from '../../src/modules/users/users.routes.js';
import { apiRouter } from '../../src/routes/index.js';

type RouterLayer = {
  handle: unknown;
  matchers: Array<(path: string) => false | { path: string }>;
};

function mounts(router: typeof apiRouter, path: string, handler: unknown): boolean {
  return (router.stack as RouterLayer[]).some(
    (layer) => layer.handle === handler && layer.matchers.some((matcher) => matcher(path) !== false),
  );
}

describe('apiRouter', () => {
  it('mounts auth, users, and ticketing under their API paths', () => {
    expect(mounts(apiRouter, '/api/v1/auth', authRouter)).toBe(true);
    expect(mounts(apiRouter, '/api/v1', usersRouter)).toBe(true);
    expect(mounts(apiRouter, '/api/v1', ticketingRouter)).toBe(true);
  });
});
