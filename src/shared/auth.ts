import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { Role } from '../generated/prisma/client.js';
import { verifyAccessToken } from '../utilities/token.js';
import { AppError } from './errors.js';

export type AuthenticatedPrincipal = {
  id: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}

export function authenticate(request: Request, _response: Response, next: NextFunction): void {
  const authorization = request.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    return;
  }

  try {
    const claims = verifyAccessToken(authorization.slice('Bearer '.length));
    request.principal = { id: claims.sub, role: claims.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function authenticateOptional(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const authorization = request.header('authorization');

  if (!authorization) {
    next();
    return;
  }

  if (!authorization.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
    return;
  }

  try {
    const claims = verifyAccessToken(authorization.slice('Bearer '.length));
    request.principal = { id: claims.sub, role: claims.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.principal) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required'));
      return;
    }

    if (!roles.includes(request.principal.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}
