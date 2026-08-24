import type { ErrorRequestHandler } from 'express';

import { AppError } from '../shared/errors.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
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

function getBodyParserError(error: unknown):
  | {
      statusCode: 400 | 413;
      body: { code: string; message: string };
    }
  | undefined {
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
