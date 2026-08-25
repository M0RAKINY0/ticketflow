import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../../shared/errors.js";
import { success } from "../../shared/response.js";
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
} from "./ticketing.schema.js";
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
} from "./ticketing.service.js";

function mapValidationError(error: unknown): unknown {
  return error instanceof ZodError
    ? new AppError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed",
        error.flatten(),
      )
    : error;
}

export async function listEventsController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = discoveryQuerySchema.parse(request.query);
    response
      .status(200)
      .json(success(await listEvents(query, request.principal)));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function getEventController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    response
      .status(200)
      .json(success({ event: await getEvent(eventId, request.principal) }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function createEventController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createEventSchema.parse(request.body);
    const event = await createEvent(request.principal!.id, input);
    response.status(201).json(success({ event }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function updateEventController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const input = updateEventSchema.parse(request.body);
    const event = await updateEvent(eventId, request.principal!, input);
    response.status(200).json(success({ event }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function publishEventController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const event = await publishEvent(eventId, request.principal!);
    response.status(200).json(success({ event }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function cancelEventController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const event = await cancelEvent(eventId, request.principal!);
    response.status(200).json(success({ event }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function listTicketTypesController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const ticketTypes = await listTicketTypes(eventId, request.principal);
    response.status(200).json(success({ ticketTypes }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function createTicketTypeController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const input = createTicketTypeSchema.parse(request.body);
    const ticketType = await createTicketType(
      eventId,
      request.principal!,
      input,
    );
    response.status(201).json(success({ ticketType }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function updateTicketTypeController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId, ticketTypeId } = ticketTypeParamsSchema.parse(
      request.params,
    );
    const input = updateTicketTypeSchema.parse(request.body);
    const ticketType = await updateTicketType(
      eventId,
      ticketTypeId,
      request.principal!,
      input,
    );
    response.status(200).json(success({ ticketType }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function deleteTicketTypeController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId, ticketTypeId } = ticketTypeParamsSchema.parse(
      request.params,
    );
    await deleteTicketType(eventId, ticketTypeId, request.principal!);
    response.status(204).send();
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function createReservationController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const { ticketTypeId } = createReservationSchema.parse(request.body);
    const idempotencyKey = idempotencyKeySchema.parse(
      request.header("idempotency-key"),
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
}

export async function listReservationsController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reservations = await listReservations(request.principal!.id);
    response.status(200).json(success({ reservations }));
  } catch (error) {
    next(error);
  }
}

export async function listTicketsController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tickets = await listTickets(request.principal!.id);
    response.status(200).json(success({ tickets }));
  } catch (error) {
    next(error);
  }
}

export async function getTicketQrController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { ticketId } = ticketParamsSchema.parse(request.params);
    response
      .status(200)
      .json(success(await getTicketQr(ticketId, request.principal!.id)));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function getTicketController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
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
}

export async function createCheckInController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const { qrPayload } = createCheckInSchema.parse(request.body);
    const checkIn = await createCheckIn(eventId, request.principal!, qrPayload);
    response.status(201).json(success({ checkIn }));
  } catch (error) {
    next(mapValidationError(error));
  }
}

export async function listCheckInsController(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { eventId } = eventIdParamsSchema.parse(request.params);
    const checkIns = await listCheckIns(eventId, request.principal!);
    response.status(200).json(success({ checkIns }));
  } catch (error) {
    next(mapValidationError(error));
  }
}
