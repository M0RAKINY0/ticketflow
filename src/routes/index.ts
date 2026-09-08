import { Router } from "express";

import { ticketingRouter } from "../modules/ticketing/ticketing.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { healthRouter } from "./health.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/api/v1", usersRouter);
apiRouter.use("/api/v1", ticketingRouter);
