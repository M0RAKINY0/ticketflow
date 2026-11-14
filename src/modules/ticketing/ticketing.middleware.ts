import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import {
  authenticate,
  authenticateOptional,
  requireRole,
} from "../../middleware/auth.middleware.js";
import { createRateLimiter } from "../../middleware/security.middleware.js";
import { AppError } from "../../shared/errors.js";

// Admins manage events. They do not hold tickets.
const rejectAdmin: RequestHandler = (request, _response, next) => {
  if (request.principal?.role === "ADMIN") {
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

export const optionalAuthentication = [authenticateOptional] as const;
export const authenticated = [authenticate] as const;
export const authenticatedUserOnly = [
  authenticate,
  requireRole("USER"),
] as const;

/**
 * Checkout is open to guests, so it gets a tighter per-IP limit than the rest
 * of the API. Without one, a script could reserve a whole event.
 */
export const reservationCheckout = [
  createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RESERVATION_RATE_LIMIT_MAX),
  authenticateOptional,
  rejectAdmin,
] as const;
