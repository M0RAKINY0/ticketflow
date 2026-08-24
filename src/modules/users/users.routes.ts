import { Router } from "express";

import { authenticate, requireRole } from "../../middleware/auth.middleware.js";
import {
  assignRoleController,
  getCurrentUserController,
  listUsersController,
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", authenticate, getCurrentUserController);

usersRouter.get(
  "/users",
  authenticate,
  requireRole("ADMIN"),
  listUsersController,
);

usersRouter.patch(
  "/users/:userId/role",
  authenticate,
  requireRole("ADMIN"),
  assignRoleController,
);
