import { Router } from "express";

import {
  assignRoleController,
  getCurrentUserController,
  listUsersController,
} from "./users.controller.js";
import { adminOnly, authenticated } from "./users.middleware.js";

export const usersRouter = Router();

usersRouter.get("/me", ...authenticated, getCurrentUserController);

usersRouter.get("/users", ...adminOnly, listUsersController);

usersRouter.patch("/users/:userId/role", ...adminOnly, assignRoleController);
