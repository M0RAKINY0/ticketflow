import type { NextFunction, Request, RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import type { Role } from "../generated/prisma/client.js";
import { auth } from "../infrastructure/auth.js";
import { AppError } from "../shared/errors.js";

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

function unauthenticated(): AppError {
  return new AppError(401, "UNAUTHENTICATED", "Authentication is required");
}

function isRole(value: unknown): value is Role {
  return value === "USER" || value === "ADMIN";
}

async function resolvePrincipal(
  request: Request,
): Promise<AuthenticatedPrincipal | undefined> {
  const authorization = request.header("authorization");

  if (authorization) {
    if (!authorization.startsWith("Bearer ")) throw unauthenticated();

    try {
      const result = await auth.api.verifyJWT({
        body: { token: authorization.slice("Bearer ".length) },
      });
      const payload = result.payload;

      if (
        !payload ||
        typeof payload.sub !== "string" ||
        !isRole(payload.role)
      ) {
        throw unauthenticated();
      }

      return { id: payload.sub, role: payload.role };
    } catch {
      throw unauthenticated();
    }
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session || !isRole(session.user.role)) return undefined;
  return { id: session.user.id, role: session.user.role };
}

export async function authenticate(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const principal = await resolvePrincipal(request);
    if (!principal) throw unauthenticated();
    request.principal = principal;
    next();
  } catch {
    next(unauthenticated());
  }
}

export async function authenticateOptional(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const principal = await resolvePrincipal(request);
    if (principal) request.principal = principal;
    next();
  } catch {
    next(unauthenticated());
  }
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.principal) {
      next(unauthenticated());
      return;
    }

    if (!roles.includes(request.principal.role)) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action",
        ),
      );
      return;
    }

    next();
  };
}
