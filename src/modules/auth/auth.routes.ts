import { Router } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../../shared/errors.js';
import { success } from '../../shared/response.js';
import { loginSchema, refreshTokenSchema, registerSchema } from './auth.schema.js';
import { login, logout, refresh, register } from './auth.service.js';

export const authRouter = Router();

function validationError(error: ZodError): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten());
}

authRouter.post('/register', async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body);
    const result = await register(input);

    response.status(201).json(success(result));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const result = await login(input);

    response.status(200).json(success(result));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    const result = await refresh(refreshToken);

    response.status(200).json(success(result));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
});

authRouter.post('/logout', async (request, response, next) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    await logout(refreshToken);

    response.status(204).send();
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
});
