import type { Request, Response, NextFunction } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z, ZodError } from "zod";
import { eventIdParamsSchema } from "./ticketing.schema.js";
import {
  eventSales,
  eventAttendees,
  attendeeExport,
} from "./reporting.service.js";
import { success } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const fail = (error: unknown, next: NextFunction) =>
  next(
    error instanceof ZodError
      ? new AppError(400, "VALIDATION_ERROR", "Request validation failed")
      : error,
  );
export async function salesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId } = eventIdParamsSchema.parse(req.params);
    res
      .set("Cache-Control", "no-store")
      .json(success({ summary: await eventSales(eventId, req.principal!) }));
  } catch (error) {
    fail(error, next);
  }
}
export async function attendeesController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId } = eventIdParamsSchema.parse(req.params);
    const { page, pageSize } = pagination.parse(req.query);
    res
      .set("Cache-Control", "no-store")
      .json(
        success(await eventAttendees(eventId, req.principal!, page, pageSize)),
      );
  } catch (error) {
    fail(error, next);
  }
}
export async function attendeeExportController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { eventId } = eventIdParamsSchema.parse(req.params);
    const rows = await attendeeExport(eventId, req.principal!);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${eventId}.csv"`,
      "Cache-Control": "no-store",
    });
    await pipeline(Readable.from(rows), res);
  } catch (error) {
    fail(error, next);
  }
}
