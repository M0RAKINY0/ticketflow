import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { ZodError } from "zod";

import { auth } from "../../infrastructure/auth.js";
import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
import { addPassword, deleteAccount } from "./account.service.js";
import { addPasswordSchema, deleteAccountSchema } from "./users.schema.js";

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed",
    error.flatten(),
  );
}

/** These settings need the browser session, not a short-lived API token. */
async function requireSession(request: Request) {
  const result = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!result || result.user.id !== request.principal?.id) {
    throw new AppError(
      401,
      "SESSION_REQUIRED",
      "Sign in on the website to change this",
    );
  }
  return result.session;
}

export async function deleteAccountController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { password } = deleteAccountSchema.parse(request.body ?? {});
    const session = await requireSession(request);
    await deleteAccount(session, password);
    response.status(204).end();
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}

export async function addPasswordController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { newPassword } = addPasswordSchema.parse(request.body);
    await requireSession(request);
    await addPassword(fromNodeHeaders(request.headers), newPassword);
    response.status(200).json(success({ status: true }));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}
