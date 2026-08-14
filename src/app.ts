import express, { type ErrorRequestHandler, type Express } from 'express';

import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { AppError } from './shared/errors.js';
import { success } from './shared/response.js';

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  const parserError = getBodyParserError(error);

  if (parserError) {
    response.status(parserError.statusCode).json({ error: parserError.body });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
};

function getBodyParserError(error: unknown): {
  statusCode: 400 | 413;
  body: { code: string; message: string };
} | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return undefined;
  }

  if (error.status === 413) {
    return {
      statusCode: 413,
      body: { code: 'REQUEST_TOO_LARGE', message: 'Request body is too large' },
    };
  }

  if (error.status === 400) {
    return {
      statusCode: 400,
      body: { code: 'INVALID_JSON', message: 'Invalid JSON body' },
    };
  }

  return undefined;
}

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json(success({ status: 'ok' }));
  });
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', usersRouter);
  app.use(errorHandler);

  return app;
}
