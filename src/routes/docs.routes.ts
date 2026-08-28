import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import swaggerUi from "swagger-ui-express";

import type { Auth } from "../infrastructure/auth.js";
import { createOpenAPIDocument } from "../infrastructure/openapi.js";

export function createDocsRouter(auth: Auth): Router {
  const router = Router();
  router.get("/api/openapi.json", async (_request, response, next) => {
    try {
      response.json(await createOpenAPIDocument(auth));
    } catch (error) {
      next(error);
    }
  });
  router.use(
    "/api/docs",
    (_request: Request, response: Response, next: NextFunction) => {
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      );
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/api/openapi.json" },
    }),
  );
  return router;
}
