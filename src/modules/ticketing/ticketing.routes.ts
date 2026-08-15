import { Router } from 'express';
import { ZodError } from 'zod';

import {
  authenticate,
  authenticateOptional,
  requireRole,
} from '../../shared/auth.js';
import { AppError } from '../../shared/errors.js';
import { success } from '../../shared/response.js';
import {
  createCheckInSchema,
  createEventSchema,
  createReservationSchema,
  createTicketTypeSchema,
  discoveryQuerySchema,
  eventIdParamsSchema,
  idempotencyKeySchema,
  ticketParamsSchema,
  ticketTypeParamsSchema,
  updateEventSchema,
  updateTicketTypeSchema,
} from './ticketing.schema.js';
import {
  cancelEvent,
  createCheckIn,
  createEvent,
  createReservation,
  createTicketType,
  deleteTicketType,
  getEvent,
  getTicket,
  getTicketQr,
  listCheckIns,
  listEvents,
  listReservations,
  listTicketTypes,
  listTickets,
  publishEvent,
  updateEvent,
  updateTicketType,
} from './ticketing.service.js';

export const ticketingRouter = Router();

ticketingRouter.get(
  '/events',
  authenticateOptional,
  async (request, response, next) => {
    try {
      const query = discoveryQuerySchema.parse(request.query);
      response
        .status(200)
        .json(success(await listEvents(query, request.principal)));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.get(
  '/events/:eventId',
  authenticateOptional,
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      response
        .status(200)
        .json(success({ event: await getEvent(eventId, request.principal) }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const input = createEventSchema.parse(request.body);
      const event = await createEvent(request.principal!.id, input);
      response.status(201).json(success({ event }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.patch(
  '/events/:eventId',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const input = updateEventSchema.parse(request.body);
      const event = await updateEvent(eventId, request.principal!.id, input);
      response.status(200).json(success({ event }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events/:eventId/publish',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const event = await publishEvent(eventId, request.principal!.id);
      response.status(200).json(success({ event }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events/:eventId/cancel',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const event = await cancelEvent(eventId, request.principal!.id);
      response.status(200).json(success({ event }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.get(
  '/events/:eventId/ticket-types',
  authenticateOptional,
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const ticketTypes = await listTicketTypes(eventId, request.principal);
      response.status(200).json(success({ ticketTypes }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events/:eventId/ticket-types',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const input = createTicketTypeSchema.parse(request.body);
      const ticketType = await createTicketType(
        eventId,
        request.principal!.id,
        input,
      );
      response.status(201).json(success({ ticketType }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.patch(
  '/events/:eventId/ticket-types/:ticketTypeId',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId, ticketTypeId } = ticketTypeParamsSchema.parse(
        request.params,
      );
      const input = updateTicketTypeSchema.parse(request.body);
      const ticketType = await updateTicketType(
        eventId,
        ticketTypeId,
        request.principal!.id,
        input,
      );
      response.status(200).json(success({ ticketType }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.delete(
  '/events/:eventId/ticket-types/:ticketTypeId',
  authenticate,
  requireRole('ORGANIZER'),
  async (request, response, next) => {
    try {
      const { eventId, ticketTypeId } = ticketTypeParamsSchema.parse(
        request.params,
      );
      await deleteTicketType(eventId, ticketTypeId, request.principal!.id);
      response.status(204).send();
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events/:eventId/reservations',
  authenticate,
  requireRole('USER'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const { ticketTypeId } = createReservationSchema.parse(request.body);
      const idempotencyKey = idempotencyKeySchema.parse(
        request.header('idempotency-key'),
      );
      const result = await createReservation(
        eventId,
        ticketTypeId,
        request.principal!.id,
        idempotencyKey,
      );
      response
        .status(result.created ? 201 : 200)
        .json(success({ reservation: result.reservation }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.get(
  '/me/reservations',
  authenticate,
  async (request, response, next) => {
    try {
      const reservations = await listReservations(request.principal!.id);
      response.status(200).json(success({ reservations }));
    } catch (error) {
      next(error);
    }
  },
);

ticketingRouter.get(
  '/me/tickets',
  authenticate,
  async (request, response, next) => {
    try {
      const tickets = await listTickets(request.principal!.id);
      response.status(200).json(success({ tickets }));
    } catch (error) {
      next(error);
    }
  },
);

ticketingRouter.get(
  '/me/tickets/:ticketId/qr',
  authenticate,
  async (request, response, next) => {
    try {
      const { ticketId } = ticketParamsSchema.parse(request.params);
      response
        .status(200)
        .json(success(await getTicketQr(ticketId, request.principal!.id)));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.get(
  '/me/tickets/:ticketId',
  authenticate,
  async (request, response, next) => {
    try {
      const { ticketId } = ticketParamsSchema.parse(request.params);
      response
        .status(200)
        .json(
          success({ ticket: await getTicket(ticketId, request.principal!.id) }),
        );
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.post(
  '/events/:eventId/check-ins',
  authenticate,
  requireRole('ORGANIZER', 'ADMIN'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const { qrPayload } = createCheckInSchema.parse(request.body);
      const checkIn = await createCheckIn(
        eventId,
        request.principal!,
        qrPayload,
      );
      response.status(201).json(success({ checkIn }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

ticketingRouter.get(
  '/events/:eventId/check-ins',
  authenticate,
  requireRole('ORGANIZER', 'ADMIN'),
  async (request, response, next) => {
    try {
      const { eventId } = eventIdParamsSchema.parse(request.params);
      const checkIns = await listCheckIns(eventId, request.principal!);
      response.status(200).json(success({ checkIns }));
    } catch (error) {
      next(mapValidationError(error));
    }
  },
);

function mapValidationError(error: unknown): unknown {
  return error instanceof ZodError
    ? new AppError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        error.flatten(),
      )
    : error;
}
