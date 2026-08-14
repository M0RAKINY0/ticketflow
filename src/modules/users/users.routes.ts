import { Router } from 'express';
import { ZodError, z } from 'zod';

import { authenticate, requireRole } from '../../shared/auth.js';
import { AppError } from '../../shared/errors.js';
import { success } from '../../shared/response.js';
import { assignRole, getCurrentUser } from './users.service.js';

const userIdSchema = z.object({ userId: z.uuid() });
const roleSchema = z.object({ role: z.enum(['USER', 'ORGANIZER']) });

export const usersRouter = Router();

function validationError(error: ZodError): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
}

usersRouter.get('/me', authenticate, async (request, response, next) => {
  try {
    const user = await getCurrentUser(request.principal!.id);

    response.status(200).json(success({ user }));
  } catch (error) {
    next(error);
  }
});

usersRouter.patch('/users/:userId/role', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const { userId } = userIdSchema.parse(request.params);
    const { role } = roleSchema.parse(request.body);
    const user = await assignRole(userId, role);

    response.status(200).json(success({ user }));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
});
