import {
  authenticate,
  authenticateOptional,
  requireRole,
} from "../../middleware/auth.middleware.js";

export const optionalAuthentication = [authenticateOptional] as const;
export const authenticated = [authenticate] as const;
export const authenticatedUserOnly = [
  authenticate,
  requireRole("USER"),
] as const;
