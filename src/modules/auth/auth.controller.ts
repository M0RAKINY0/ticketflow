import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
import { refreshCookieName, refreshCookieOptions } from "./auth.cookie.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { login, logout, refresh, register } from "./auth.service.js";

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    "VALIDATION_ERROR",
    "Request validation failed",
    error.flatten(),
  );
}

export async function registerController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = registerSchema.parse(request.body);
    const result = await register(input);
    const { refreshToken, ...body } = result;

    response
      .cookie(
        refreshCookieName,
        refreshToken,
        refreshCookieOptions(env.NODE_ENV === "production"),
      )
      .status(201)
      .json(success(body));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}

export async function loginController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = loginSchema.parse(request.body);
    const result = await login(input);
    const { refreshToken, ...body } = result;

    response
      .cookie(
        refreshCookieName,
        refreshToken,
        refreshCookieOptions(env.NODE_ENV === "production"),
      )
      .status(200)
      .json(success(body));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}

export async function refreshController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = request.cookies[refreshCookieName] as string | undefined;
    if (!rawToken) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
    }
    const result = await refresh(rawToken);
    const { refreshToken, ...body } = result;

    response
      .cookie(
        refreshCookieName,
        refreshToken,
        refreshCookieOptions(env.NODE_ENV === "production"),
      )
      .status(200)
      .json(success(body));
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}

export async function logoutController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = request.cookies[refreshCookieName] as string | undefined;
    if (rawToken) await logout(rawToken);

    response
      .clearCookie(
        refreshCookieName,
        refreshCookieOptions(env.NODE_ENV === "production"),
      )
      .status(204)
      .send();
  } catch (error) {
    next(error instanceof ZodError ? validationError(error) : error);
  }
}
