import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../src/middleware/error.middleware.js";
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
} from "../../src/modules/ticketing/ticketing.controller.js";
import {
  authenticated as ticketingAuthenticated,
  authenticatedUserOnly,
  optionalAuthentication,
} from "../../src/modules/ticketing/ticketing.middleware.js";
import { ticketingRouter } from "../../src/modules/ticketing/ticketing.routes.js";
import {
  assignRoleController,
  getCurrentUserController,
  listUsersController,
} from "../../src/modules/users/users.controller.js";
import {
  adminOnly,
  authenticated as usersAuthenticated,
} from "../../src/modules/users/users.middleware.js";
import { usersRouter } from "../../src/modules/users/users.routes.js";
import { AppError } from "../../src/shared/errors.js";
import { success } from "../../src/shared/response.js";
import { issueTestJwt } from "../helpers/auth.js";

const usersService = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listUsers: vi.fn(),
  assignRole: vi.fn(),
}));

const ticketingService = vi.hoisted(() => ({
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  publishEvent: vi.fn(),
  cancelEvent: vi.fn(),
  listTicketTypes: vi.fn(),
  createTicketType: vi.fn(),
  updateTicketType: vi.fn(),
  deleteTicketType: vi.fn(),
  createReservation: vi.fn(),
  listReservations: vi.fn(),
  listTickets: vi.fn(),
  getTicketQr: vi.fn(),
  getTicket: vi.fn(),
  createCheckIn: vi.fn(),
  listCheckIns: vi.fn(),
}));

vi.mock("../../src/modules/users/users.service.js", () => usersService);
vi.mock(
  "../../src/modules/ticketing/ticketing.service.js",
  () => ticketingService,
);

type ResponseDouble = Pick<
  Response,
  "status" | "json" | "cookie" | "clearCookie" | "send"
>;

function responseDouble(): ResponseDouble {
  const response: ResponseDouble = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    send: vi.fn(),
  };

  for (const method of Object.values(response)) {
    vi.mocked(method).mockReturnValue(response as never);
  }

  return response;
}

function routeHandlers(
  router: typeof usersRouter | typeof ticketingRouter,
  path: string,
  method: string,
): unknown[] {
  const routeLayer = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  );

  if (!routeLayer?.route) {
    throw new Error(`Route ${method.toUpperCase()} ${path} is not registered`);
  }

  return routeLayer.route.stack.map((layer) => layer.handle);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("user controllers", () => {
  it("wraps the current public user in the established response envelope", async () => {
    const user = { id: "user-1", email: "person@example.com" };
    const response = responseDouble();
    const next = vi.fn<NextFunction>();
    usersService.getCurrentUser.mockResolvedValue(user);

    await getCurrentUserController(
      { principal: { id: "user-1", role: "USER" } } as Request,
      response as Response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(success({ user }));
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards invalid list query input through the established validation error", async () => {
    const response = responseDouble();
    const next = vi.fn<NextFunction>();

    await listUsersController(
      { query: { page: "zero" } } as Request,
      response as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: "VALIDATION_ERROR" }),
    );
    expect(response.json).not.toHaveBeenCalled();
  });

  it("returns the role-assignment user in the established response envelope", async () => {
    const user = { id: "user-1", role: "ADMIN" };
    const response = responseDouble();
    const next = vi.fn<NextFunction>();
    usersService.assignRole.mockResolvedValue(user);

    await assignRoleController(
      {
        params: { userId: "1e4486b5-9d96-4e34-a306-12b01197c6a5" },
        body: { role: "ADMIN" },
      } as Request,
      response as Response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(success({ user }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe("user routes", () => {
  it("keeps complete feature access chains before protected user controllers", async () => {
    expect(routeHandlers(usersRouter, "/me", "get")).toEqual([
      ...usersAuthenticated,
      getCurrentUserController,
    ]);

    expect(routeHandlers(usersRouter, "/users", "get")).toEqual([
      ...adminOnly,
      listUsersController,
    ]);
    expect(routeHandlers(usersRouter, "/users/:userId/role", "patch")).toEqual([
      ...adminOnly,
      assignRoleController,
    ]);

    const app = express();
    app.use(usersRouter);
    app.use(errorHandler);

    await request(app)
      .get("/users")
      .expect(401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required",
        },
      });
    await request(app)
      .get("/users")
      .set(
        "authorization",
        `Bearer ${await issueTestJwt({ id: "1e4486b5-9d96-4e34-a306-12b01197c6a5", role: "USER" })}`,
      )
      .expect(403, {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action",
        },
      });
  });
});

describe("ticketing controllers and routes", () => {
  const eventId = "1e4486b5-9d96-4e34-a306-12b01197c6a5";
  const ticketId = "2e4486b5-9d96-4e34-a306-12b01197c6a5";
  const userId = "3e4486b5-9d96-4e34-a306-12b01197c6a5";
  let userToken: string;

  beforeAll(async () => {
    userToken = await issueTestJwt({ id: userId, role: "USER" });
  });

  it.each([
    ["get", "/events", [...optionalAuthentication, listEventsController]],
    [
      "get",
      "/events/:eventId",
      [...optionalAuthentication, getEventController],
    ],
    ["post", "/events", [...ticketingAuthenticated, createEventController]],
    [
      "patch",
      "/events/:eventId",
      [...ticketingAuthenticated, updateEventController],
    ],
    [
      "post",
      "/events/:eventId/publish",
      [...ticketingAuthenticated, publishEventController],
    ],
    [
      "post",
      "/events/:eventId/cancel",
      [...ticketingAuthenticated, cancelEventController],
    ],
    [
      "get",
      "/events/:eventId/ticket-types",
      [...optionalAuthentication, listTicketTypesController],
    ],
    [
      "post",
      "/events/:eventId/ticket-types",
      [...ticketingAuthenticated, createTicketTypeController],
    ],
    [
      "patch",
      "/events/:eventId/ticket-types/:ticketTypeId",
      [...ticketingAuthenticated, updateTicketTypeController],
    ],
    [
      "delete",
      "/events/:eventId/ticket-types/:ticketTypeId",
      [...ticketingAuthenticated, deleteTicketTypeController],
    ],
    [
      "post",
      "/events/:eventId/reservations",
      [...authenticatedUserOnly, createReservationController],
    ],
    [
      "get",
      "/me/reservations",
      [...ticketingAuthenticated, listReservationsController],
    ],
    ["get", "/me/tickets", [...ticketingAuthenticated, listTicketsController]],
    [
      "get",
      "/me/tickets/:ticketId/qr",
      [...ticketingAuthenticated, getTicketQrController],
    ],
    [
      "get",
      "/me/tickets/:ticketId",
      [...ticketingAuthenticated, getTicketController],
    ],
    [
      "post",
      "/events/:eventId/check-ins",
      [...ticketingAuthenticated, createCheckInController],
    ],
    [
      "get",
      "/events/:eventId/check-ins",
      [...ticketingAuthenticated, listCheckInsController],
    ],
  ])(
    "connects %s %s to its complete established handler chain",
    (method, path, expectedHandlers) => {
      const handlers = routeHandlers(ticketingRouter, path, method);

      expect(handlers).toHaveLength(expectedHandlers.length);
      expect(handlers).toEqual(expectedHandlers);
    },
  );

  it("keeps user-role enforcement before reservation handling", async () => {
    const handlers = routeHandlers(
      ticketingRouter,
      "/events/:eventId/reservations",
      "post",
    );
    expect(handlers).toHaveLength(3);

    const app = express();
    app.use(express.json());
    app.use(ticketingRouter);
    app.use(errorHandler);

    await request(app)
      .post(`/events/${eventId}/reservations`)
      .set(
        "authorization",
        `Bearer ${await issueTestJwt({ id: userId, role: "ADMIN" })}`,
      )
      .set("idempotency-key", "reservation-key")
      .send({ ticketTypeId: ticketId })
      .expect(403, {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action",
        },
      });
    expect(ticketingService.createReservation).not.toHaveBeenCalled();
  });

  it("returns 201 for a new reservation and 200 for its idempotent replay", async () => {
    const reservation = { id: "reservation-1" };
    ticketingService.createReservation
      .mockResolvedValueOnce({ created: true, reservation })
      .mockResolvedValueOnce({ created: false, reservation });
    const app = express();
    app.use(express.json());
    app.use(ticketingRouter);
    app.use(errorHandler);

    const makeRequest = () =>
      request(app)
        .post(`/events/${eventId}/reservations`)
        .set("authorization", `Bearer ${userToken}`)
        .set("idempotency-key", "reservation-key")
        .send({ ticketTypeId: ticketId });

    await makeRequest().expect(201, { data: { reservation } });
    await makeRequest().expect(200, { data: { reservation } });
    expect(ticketingService.createReservation).toHaveBeenNthCalledWith(
      1,
      eventId,
      ticketId,
      userId,
      "reservation-key",
    );
  });

  it("maps malformed ticketing input to the established validation error", async () => {
    const app = express();
    app.use(express.json());
    app.use(ticketingRouter);
    app.use(errorHandler);

    await request(app)
      .get("/events/not-a-uuid")
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toEqual({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: expect.any(Object),
        });
      });
    expect(ticketingService.getEvent).not.toHaveBeenCalled();
  });

  it("forwards service failures through the shared error handler", async () => {
    ticketingService.getTicket.mockRejectedValue(
      new AppError(404, "TICKET_NOT_FOUND", "Ticket was not found"),
    );
    const app = express();
    app.use(ticketingRouter);
    app.use(errorHandler);

    await request(app)
      .get(`/me/tickets/${ticketId}`)
      .set("authorization", `Bearer ${userToken}`)
      .expect(404, {
        error: {
          code: "TICKET_NOT_FOUND",
          message: "Ticket was not found",
        },
      });
  });
});
