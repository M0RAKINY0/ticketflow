import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { recoverTickets, resetReservationLink } from "./recovery.service.js";
import { reservationParamsSchema } from "./ticketing.schema.js";
import { success } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
const input = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});
const resetInput = z.object({
  token: z.string().min(1).max(100).optional(),
});
export async function recoverTicketsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = input.parse(req.body);
    await recoverTickets(email);
    res
      .status(202)
      .set("Cache-Control", "no-store")
      .json(
        success({
          message:
            "If reservations match that email, we will send their links.",
        }),
      );
  } catch (error) {
    next(
      error instanceof ZodError
        ? new AppError(400, "VALIDATION_ERROR", "Enter a valid email address")
        : error,
    );
  }
}
export async function resetReservationLinkController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { reservationId } = reservationParamsSchema.parse(req.params);
    const { token } = resetInput.parse(req.body ?? {});
    await resetReservationLink(reservationId, token, req.principal);
    res
      .status(202)
      .set("Cache-Control", "no-store")
      .json(
        success({
          message:
            "Old links no longer work. We sent a new link to the email used at checkout.",
        }),
      );
  } catch (error) {
    next(
      error instanceof ZodError
        ? new AppError(400, "VALIDATION_ERROR", "Invalid reset request")
        : error,
    );
  }
}
