import { Router } from "express";

import {
  authenticate,
  authenticateOptional,
  requireRole,
} from "../../middleware/auth.middleware.js";
import {
  cancelEventController,
  createCheckInController,
  createEventController,
  createReservationController,
  createTicketTypeController,
  deleteTicketTypeController,
  getEventController,
  getTicketController,
  getTicketQrController,
  listCheckInsController,
  listEventsController,
  listReservationsController,
  listTicketTypesController,
  listTicketsController,
  publishEventController,
  updateEventController,
  updateTicketTypeController,
} from "./ticketing.controller.js";

export const ticketingRouter = Router();

ticketingRouter.get("/events", authenticateOptional, listEventsController);

ticketingRouter.get(
  "/events/:eventId",
  authenticateOptional,
  getEventController,
);

ticketingRouter.post("/events", authenticate, createEventController);

ticketingRouter.patch("/events/:eventId", authenticate, updateEventController);

ticketingRouter.post(
  "/events/:eventId/publish",
  authenticate,
  publishEventController,
);

ticketingRouter.post(
  "/events/:eventId/cancel",
  authenticate,
  cancelEventController,
);

ticketingRouter.get(
  "/events/:eventId/ticket-types",
  authenticateOptional,
  listTicketTypesController,
);

ticketingRouter.post(
  "/events/:eventId/ticket-types",
  authenticate,
  createTicketTypeController,
);

ticketingRouter.patch(
  "/events/:eventId/ticket-types/:ticketTypeId",
  authenticate,
  updateTicketTypeController,
);

ticketingRouter.delete(
  "/events/:eventId/ticket-types/:ticketTypeId",
  authenticate,
  deleteTicketTypeController,
);

ticketingRouter.post(
  "/events/:eventId/reservations",
  authenticate,
  requireRole("USER"),
  createReservationController,
);

ticketingRouter.get(
  "/me/reservations",
  authenticate,
  listReservationsController,
);

ticketingRouter.get("/me/tickets", authenticate, listTicketsController);

ticketingRouter.get(
  "/me/tickets/:ticketId/qr",
  authenticate,
  getTicketQrController,
);

ticketingRouter.get("/me/tickets/:ticketId", authenticate, getTicketController);

ticketingRouter.post(
  "/events/:eventId/check-ins",
  authenticate,
  createCheckInController,
);

ticketingRouter.get(
  "/events/:eventId/check-ins",
  authenticate,
  listCheckInsController,
);
