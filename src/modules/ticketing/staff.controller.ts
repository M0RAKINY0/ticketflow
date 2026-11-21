import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
import {
  addEventStaff,
  listEventStaff,
  listStaffEvents,
  removeEventStaff,
} from "./staff.service.js";
import {
  addStaffSchema,
  eventIdParamsSchema,
  staffParamsSchema,
} from "./ticketing.schema.js";

function mapError(error: unknown) {
  return error instanceof ZodError
    ? new AppError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed",
        error.flatten(),
      )
    : error;
}

export async function listEventStaffController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId } = eventIdParamsSchema.parse(req.params);
    const staff = await listEventStaff(eventId, req.principal!);
    res.status(200).json(success({ staff }));
  } catch (error) {
    next(mapError(error));
  }
}

export async function addEventStaffController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId } = eventIdParamsSchema.parse(req.params);
    const { email } = addStaffSchema.parse(req.body);
    const member = await addEventStaff(eventId, req.principal!, email);
    res.status(201).json(success({ staff: member }));
  } catch (error) {
    next(mapError(error));
  }
}

export async function removeEventStaffController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId, userId } = staffParamsSchema.parse(req.params);
    await removeEventStaff(eventId, req.principal!, userId);
    res.status(204).end();
  } catch (error) {
    next(mapError(error));
  }
}

export async function listStaffEventsController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const events = await listStaffEvents(req.principal!.id);
    res.status(200).json(success({ events }));
  } catch (error) {
    next(error);
  }
}
