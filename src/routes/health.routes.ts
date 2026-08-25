import { Router } from "express";

import { success } from "../shared/response.js";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json(success({ status: "ok" }));
});
