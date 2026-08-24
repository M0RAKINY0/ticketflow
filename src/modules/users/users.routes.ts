import { Router } from 'express';
import { ZodError, z } from 'zod';

import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { AppError } from '../../shared/errors.js';
import { success } from '../../shared/response.js';
import { assignRole, getCurrentUser, listUsers } from './users.service.js';

const userIdSchema = z.object({ userId: z.uuid() });
const roleSchema = z.object({ role: z.enum(['USER', 'ADMIN']) });
const userListQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const usersRouter = Router();

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    'VALIDATION_ERROR',
    'Request validation failed',
    error.flatten(),
  );
}

usersRouter.get('/me', authenticate, async (request, response, next) => {
  try {
    const user = await getCurrentUser(request.principal!.id);

    response.status(200).json(success({ user }));
  } catch (error) {
    next(error);
  }
});

usersRouter.get(
  '/users',
  authenticate,
  requireRole('ADMIN'),
  async (request, response, next) => {
    try {
      const input = userListQuerySchema.parse(request.query);
      response.status(200).json(success(await listUsers(input)));
    } catch (error) {
      next(error instanceof ZodError ? validationError(error) : error);
    }
  },
);

usersRouter.patch(
  '/users/:userId/role',
  authenticate,
  requireRole('ADMIN'),
  async (request, response, next) => {
    try {
      const { userId } = userIdSchema.parse(request.params);
      const { role } = roleSchema.parse(request.body);
      const user = await assignRole(userId, role);

      response.status(200).json(success({ user }));
    } catch (error) {
      next(error instanceof ZodError ? validationError(error) : error);
    }
  },
);
