import { Router } from "express";

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
import {
  authenticated,
  authenticatedUserOnly,
  optionalAuthentication,
} from "./ticketing.middleware.js";

export const ticketingRouter = Router();

ticketingRouter.get("/events", ...optionalAuthentication, listEventsController);

ticketingRouter.get(
  "/events/:eventId",
  ...optionalAuthentication,
  getEventController,
);

ticketingRouter.post("/events", ...authenticated, createEventController);

ticketingRouter.patch(
  "/events/:eventId",
  ...authenticated,
  updateEventController,
);

ticketingRouter.post(
  "/events/:eventId/publish",
  ...authenticated,
  publishEventController,
);

ticketingRouter.post(
  "/events/:eventId/cancel",
  ...authenticated,
  cancelEventController,
);

ticketingRouter.get(
  "/events/:eventId/ticket-types",
  ...optionalAuthentication,
  listTicketTypesController,
);

ticketingRouter.post(
  "/events/:eventId/ticket-types",
  ...authenticated,
  createTicketTypeController,
);

ticketingRouter.patch(
  "/events/:eventId/ticket-types/:ticketTypeId",
  ...authenticated,
  updateTicketTypeController,
);

ticketingRouter.delete(
  "/events/:eventId/ticket-types/:ticketTypeId",
  ...authenticated,
  deleteTicketTypeController,
);

ticketingRouter.post(
  "/events/:eventId/reservations",
  ...authenticatedUserOnly,
  createReservationController,
);

ticketingRouter.get(
  "/me/reservations",
  ...authenticated,
  listReservationsController,
);

ticketingRouter.get("/me/tickets", ...authenticated, listTicketsController);

ticketingRouter.get(
  "/me/tickets/:ticketId/qr",
  ...authenticated,
  getTicketQrController,
);

ticketingRouter.get(
  "/me/tickets/:ticketId",
  ...authenticated,
  getTicketController,
);

ticketingRouter.post(
  "/events/:eventId/check-ins",
  ...authenticated,
  createCheckInController,
);

ticketingRouter.get(
  "/events/:eventId/check-ins",
  ...authenticated,
  listCheckInsController,
);
