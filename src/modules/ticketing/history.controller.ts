import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
import { listAttendedHistory, listHostedHistory } from "./history.service.js";

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function historyController(
  list: (
    userId: string,
    page: { page: number; pageSize: number },
  ) => Promise<unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(200)
        .json(
          success(await list(req.principal!.id, pagination.parse(req.query))),
        );
    } catch (error) {
      next(
        error instanceof ZodError
          ? new AppError(400, "VALIDATION_ERROR", "Invalid page or page size")
          : error,
      );
    }
  };
}

export const hostedHistoryController = historyController(listHostedHistory);
export const attendedHistoryController = historyController(listAttendedHistory);
