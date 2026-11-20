import { Router } from "express";

import {
  cancelEventController,
  claimReservationController,
  createCheckInController,
  createEventController,
  createReservationController,
  createTicketTypeController,
  deleteTicketTypeController,
  getEventController,
  getEventBySlugController,
  getReservationController,
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
  reservationCheckout,
} from "./ticketing.middleware.js";

import {
  salesController,
  attendeesController,
  attendeeExportController,
} from "./reporting.controller.js";

import {
  recoverTicketsController,
  resetReservationLinkController,
} from "./recovery.controller.js";
import { createRateLimiter } from "../../middleware/security.middleware.js";
import {
  attendedHistoryController,
  hostedHistoryController,
} from "./history.controller.js";

export const ticketingRouter = Router();

ticketingRouter.post(
  "/reservations/recover",
  createRateLimiter(15 * 60 * 1000, 5),
  recoverTicketsController,
);

ticketingRouter.get(
  "/events/by-slug/:slug",
  ...optionalAuthentication,
  getEventBySlugController,
);

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
  ...reservationCheckout,
  createReservationController,
);

ticketingRouter.get(
  "/reservations/:reservationId",
  ...optionalAuthentication,
  getReservationController,
);

ticketingRouter.post(
  "/reservations/:reservationId/reset-link",
  createRateLimiter(15 * 60 * 1000, 5),
  ...optionalAuthentication,
  resetReservationLinkController,
);

ticketingRouter.post(
  "/reservations/:reservationId/claim",
  ...authenticatedUserOnly,
  claimReservationController,
);

ticketingRouter.get(
  "/me/reservations",
  ...authenticated,
  listReservationsController,
);

ticketingRouter.get("/me/tickets", ...authenticated, listTicketsController);

ticketingRouter.get(
  "/me/history/hosted",
  ...authenticated,
  hostedHistoryController,
);

ticketingRouter.get(
  "/me/history/attended",
  ...authenticated,
  attendedHistoryController,
);

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

ticketingRouter.get(
  "/events/:eventId/sales",
  ...authenticated,
  salesController,
);
ticketingRouter.get(
  "/events/:eventId/attendees",
  ...authenticated,
  attendeesController,
);
ticketingRouter.get(
  "/events/:eventId/attendees.csv",
  ...authenticated,
  attendeeExportController,
);
