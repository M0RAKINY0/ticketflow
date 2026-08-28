import type { Auth } from "./auth.js";

type OpenAPIDocument = Record<string, any>;

const operations = [
  ["get", "/health", "Health", false],
  ["get", "/api/v1/me", "Users", true],
  ["get", "/api/v1/users", "Users", true],
  ["patch", "/api/v1/users/{userId}/role", "Users", true],
  ["get", "/api/v1/events", "Events", false],
  ["post", "/api/v1/events", "Events", true],
  ["get", "/api/v1/events/{eventId}", "Events", false],
  ["patch", "/api/v1/events/{eventId}", "Events", true],
  ["post", "/api/v1/events/{eventId}/publish", "Events", true],
  ["post", "/api/v1/events/{eventId}/cancel", "Events", true],
  ["get", "/api/v1/events/{eventId}/ticket-types", "Ticket types", false],
  ["post", "/api/v1/events/{eventId}/ticket-types", "Ticket types", true],
  [
    "patch",
    "/api/v1/events/{eventId}/ticket-types/{ticketTypeId}",
    "Ticket types",
    true,
  ],
  [
    "delete",
    "/api/v1/events/{eventId}/ticket-types/{ticketTypeId}",
    "Ticket types",
    true,
  ],
  ["post", "/api/v1/events/{eventId}/reservations", "Reservations", true],
  ["get", "/api/v1/me/reservations", "Reservations", true],
  ["get", "/api/v1/me/tickets", "Tickets", true],
  ["get", "/api/v1/me/tickets/{ticketId}", "Tickets", true],
  ["get", "/api/v1/me/tickets/{ticketId}/qr", "Tickets", true],
  ["post", "/api/v1/events/{eventId}/check-ins", "Check-ins", true],
  ["get", "/api/v1/events/{eventId}/check-ins", "Check-ins", true],
] as const;

const ventraPaths: Record<string, Record<string, unknown>> = {};
for (const [method, path, tag, secured] of operations) {
  const parameters: Record<string, unknown>[] = [
    ...path.matchAll(/\{([^}]+)\}/g),
  ].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  }));
  ventraPaths[path] ??= {};
  const requestSchema = path.endsWith("/role")
    ? "RoleUpdate"
    : path.endsWith("/reservations")
      ? "ReservationInput"
      : path.endsWith("/check-ins")
        ? "CheckInInput"
        : path.includes("ticket-types")
          ? "TicketTypeInput"
          : path.includes("/events")
            ? "EventInput"
            : undefined;
  if (path.endsWith("/reservations") && method === "post") {
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string" },
    });
  }
  ventraPaths[path]![method] = {
    tags: [tag],
    summary: `${method.toUpperCase()} ${path}`,
    description:
      tag === "Users" && path.includes("/users")
        ? "Requires the ADMIN role."
        : undefined,
    parameters,
    security: secured ? [{ sessionCookie: [] }, { bearerAuth: [] }] : [],
    requestBody:
      ["post", "patch"].includes(method) && requestSchema
        ? {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${requestSchema}` },
              },
            },
          }
        : undefined,
    responses: {
      "200": { description: "Success" },
      "201": { description: "Created" },
      "400": { $ref: "#/components/responses/Error" },
      "401": { $ref: "#/components/responses/Error" },
      "403": { $ref: "#/components/responses/Error" },
      "404": { $ref: "#/components/responses/Error" },
    },
  };
}

export async function createOpenAPIDocument(
  auth: Auth,
): Promise<OpenAPIDocument> {
  const authDocument =
    (await auth.api.generateOpenAPISchema()) as OpenAPIDocument;
  const authPaths = Object.fromEntries(
    Object.entries(authDocument.paths ?? {}).map(([path, operation]) => [
      path.startsWith("/api/v1/auth") ? path : `/api/v1/auth${path}`,
      operation,
    ]),
  );
  return {
    openapi: "3.1.1",
    info: {
      title: "Ventra API",
      version: "1.0.0",
      description:
        "Event ticketing, authentication, reservations, tickets, and check-ins.",
    },
    servers: [{ url: "/", description: "Current server" }],
    tags: [
      "Health",
      "Users",
      "Events",
      "Ticket types",
      "Reservations",
      "Tickets",
      "Check-ins",
    ].map((name) => ({ name })),
    paths: { ...authPaths, ...ventraPaths },
    components: {
      ...authDocument.components,
      securitySchemes: {
        ...(authDocument.components?.securitySchemes ?? {}),
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
        },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ...(authDocument.components?.schemas ?? {}),
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        RoleUpdate: {
          type: "object",
          required: ["role"],
          properties: { role: { type: "string", enum: ["USER", "ADMIN"] } },
        },
        ReservationInput: {
          type: "object",
          required: ["ticketTypeId"],
          properties: { ticketTypeId: { type: "string", format: "uuid" } },
        },
        CheckInInput: {
          type: "object",
          required: ["qrPayload"],
          properties: {
            qrPayload: {
              type: "string",
              example: "ticket-uuid.hmac-signature",
            },
          },
        },
        TicketTypeInput: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number", minimum: 0 },
            capacity: { type: "integer", minimum: 1 },
          },
        },
        EventInput: {
          type: "object",
          properties: {
            title: { type: "string", example: "Lagos Live" },
            description: { type: "string" },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            venue: { type: "string" },
            category: {
              type: "string",
              enum: [
                "MUSIC",
                "BUSINESS",
                "TECHNOLOGY",
                "ARTS_CULTURE",
                "FOOD_DRINK",
                "SPORTS_FITNESS",
                "COMMUNITY",
                "EDUCATION",
                "OTHER",
              ],
            },
            city: { type: "string" },
            countryCode: { type: "string", minLength: 2, maxLength: 2 },
            currency: { type: "string", minLength: 3, maxLength: 3 },
            timezone: { type: "string", example: "Africa/Lagos" },
            coverImageUrl: { type: "string", format: "uri" },
          },
        },
      },
      responses: {
        ...(authDocument.components?.responses ?? {}),
        Error: {
          description: "Ventra error envelope",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  };
}
