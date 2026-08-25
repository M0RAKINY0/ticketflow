import { authenticate, requireRole } from "../../middleware/auth.middleware.js";

export const authenticated = [authenticate] as const;
export const adminOnly = [authenticate, requireRole("ADMIN")] as const;
