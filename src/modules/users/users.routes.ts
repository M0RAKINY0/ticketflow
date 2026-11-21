import { Router } from "express";

import { createRateLimiter } from "../../middleware/security.middleware.js";
import {
  addPasswordController,
  deleteAccountController,
} from "./account.controller.js";
import {
  assignRoleController,
  getCurrentUserController,
  getOrganizerProfileController,
  listUsersController,
  saveOrganizerProfileController,
} from "./users.controller.js";
import { adminOnly, authenticated } from "./users.middleware.js";

export const usersRouter = Router();

usersRouter.get("/me", ...authenticated, getCurrentUserController);

usersRouter.delete(
  "/me",
  createRateLimiter(15 * 60 * 1000, 5),
  ...authenticated,
  deleteAccountController,
);

usersRouter.post(
  "/me/password",
  createRateLimiter(15 * 60 * 1000, 5),
  ...authenticated,
  addPasswordController,
);

usersRouter.get(
  "/me/organizer-profile",
  ...authenticated,
  getOrganizerProfileController,
);

usersRouter.put(
  "/me/organizer-profile",
  ...authenticated,
  saveOrganizerProfileController,
);

usersRouter.get("/users", ...adminOnly, listUsersController);

usersRouter.patch("/users/:userId/role", ...adminOnly, assignRoleController);
