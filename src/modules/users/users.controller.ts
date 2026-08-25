import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
import {
  userIdSchema,
  roleSchema,
  userListQuerySchema,
} from "./users.schema.js";
import { assignRole, getCurrentUser, listUsers } from "./users.service.js";

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed",
    error.flatten(),
  );
}

export async function getCurrentUserController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(request.principal!.id);

    response.status(200).json(success({ user }));
  } catch (error) {
    next(error);
  }
}

export async function listUsersController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = userListQuerySchema.parse(request.query);
    response.status(200).json(success(await listUsers(input)));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}

export async function assignRoleController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { userId } = userIdSchema.parse(request.params);
    const { role } = roleSchema.parse(request.body);
    const user = await assignRole(userId, role);

    response.status(200).json(success({ user }));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}
