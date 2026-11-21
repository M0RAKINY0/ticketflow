import type { Auth } from "./auth.js";

type OpenAPIDocument = Record<string, any>;

const operations = [
  ["get", "/health", "Health", false],
  ["get", "/api/v1/me", "Users", true],
  ["delete", "/api/v1/me", "Users", true],
  ["post", "/api/v1/me/password", "Users", true],
  ["get", "/api/v1/me/history/hosted", "Users", true],
  ["get", "/api/v1/me/history/attended", "Users", true],
  ["get", "/api/v1/users", "Users", true],
  ["patch", "/api/v1/users/{userId}/role", "Users", true],
  ["get", "/api/v1/events", "Events", false],
  ["get", "/api/v1/events/by-slug/{slug}", "Events", false],
  ["get", "/api/v1/events/{eventId}/sales", "Events", true],
  ["get", "/api/v1/events/{eventId}/attendees", "Events", true],
  ["get", "/api/v1/events/{eventId}/attendees.csv", "Events", true],
  ["post", "/api/v1/reservations/recover", "Reservations", false],
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
  ["post", "/api/v1/events/{eventId}/reservations", "Reservations", false],
  ["get", "/api/v1/reservations/{reservationId}", "Reservations", false],
  [
    "post",
    "/api/v1/reservations/{reservationId}/reset-link",
    "Reservations",
    false,
  ],
  ["post", "/api/v1/reservations/{reservationId}/claim", "Reservations", true],
  ["get", "/api/v1/me/reservations", "Reservations", true],
  ["get", "/api/v1/me/tickets", "Tickets", true],
  ["get", "/api/v1/me/tickets/{ticketId}", "Tickets", true],
  ["get", "/api/v1/me/tickets/{ticketId}/qr", "Tickets", true],
  ["post", "/api/v1/events/{eventId}/check-ins", "Check-ins", true],
  ["get", "/api/v1/events/{eventId}/check-ins", "Check-ins", true],
] as const;

const accountDescriptions: Record<string, string> = {
  "delete /api/v1/me":
    "Deletes the signed-in account. Needs the browser session. Send `password` if the account has one; a Google-only account must have signed in within the last 10 minutes. Returns 409 while the account hosts an upcoming event with sales (ACCOUNT_HOSTS_LIVE_EVENTS), holds tickets to an upcoming event (ACCOUNT_HAS_UPCOMING_TICKETS), or is the last admin (LAST_ADMIN). Personal details are scrubbed and every session is signed out. Past events and orders stay, labelled 'Deleted user'. Returns 204.",
  "post /api/v1/me/password":
    "Adds a password to an account that signs in with Google only. Returns 409 PASSWORD_ALREADY_SET when one exists; use /api/v1/auth/change-password instead.",
  "get /api/v1/me/history/hosted":
    "Events the caller hosted that have ended, newest first. Includes cancelled events and `ticketsSold`. Drafts are left out.",
  "get /api/v1/me/history/attended":
    "Ended events the caller held valid tickets for, newest first. Cancelled events and orders are left out. `checkedIn` is true when a ticket was scanned at the door.",
};

const ventraPaths: Record<string, Record<string, unknown>> = {};
for (const [method, path, tag, secured] of operations) {
  const parameters: Record<string, unknown>[] = [
    ...path.matchAll(/\{([^}]+)\}/g),
  ].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema:
      match[1] === "slug"
        ? {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            maxLength: 100,
          }
        : { type: "string", format: "uuid" },
  }));
  ventraPaths[path] ??= {};
  const requestSchema = path.endsWith("/me/password")
    ? "AddPasswordInput"
    : path === "/api/v1/me" && method === "delete"
      ? "DeleteAccountInput"
      : path.endsWith("/recover")
        ? "TicketRecoveryInput"
        : path.endsWith("/role")
          ? "RoleUpdate"
          : path.endsWith("/claim")
            ? "ReservationClaimInput"
            : path.endsWith("/reset-link")
              ? "ReservationLinkResetInput"
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
  if (path.endsWith("/reservations/{reservationId}")) {
    parameters.push({
      name: "token",
      in: "query",
      required: false,
      description:
        "Reservation access token from the checkout response or the ticket email. Signed-in owners can omit it.",
      schema: { type: "string" },
    });
  }
  if (path.endsWith("/attendees") || path.includes("/me/history/"))
    parameters.push(
      {
        name: "page",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 },
      },
      {
        name: "pageSize",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    );
  ventraPaths[path]![method] = {
    tags: [tag],
    summary: `${method.toUpperCase()} ${path}`,
    description:
      tag === "Users" && path.includes("/users")
        ? "Requires the ADMIN role."
        : (accountDescriptions[`${method} ${path}`] ??
          (path.endsWith("/reservations") && method === "post"
            ? "Open to guests and signed-in users. Guests must send a buyer name and email."
            : path.endsWith("/reset-link")
              ? "Kills every existing link to the reservation and emails a fresh one to the buyer. Send a live access token, or call as the signed-in owner or an admin. The new link never appears in the response."
              : path.endsWith("/reservations/{reservationId}") ||
                  path.endsWith("/claim")
                ? "Access-token links expire 30 days after the event ends and return 410 RESERVATION_LINK_EXPIRED."
                : undefined)),
    parameters,
    security: secured ? [{ sessionCookie: [] }, { bearerAuth: [] }] : [],
    requestBody:
      (["post", "patch"].includes(method) ||
        requestSchema === "DeleteAccountInput") &&
      requestSchema
        ? {
            required: method !== "delete",
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
      ...(path.endsWith("/recover")
        ? {
            "202": {
              description:
                "If reservations match that email, we will send their links.",
            },
          }
        : {}),
      ...(path.endsWith("/reset-link")
        ? {
            "202": {
              description:
                "Old links no longer work. A new link went to the buyer's email.",
            },
          }
        : {}),
      ...(path.endsWith("/reservations/{reservationId}") ||
      path.endsWith("/claim") ||
      path.endsWith("/reset-link")
        ? { "410": { $ref: "#/components/responses/Error" } }
        : {}),
      ...(path.endsWith(".csv")
        ? {
            "200": {
              description: "Owner/admin attendee export",
              content: { "text/csv": { schema: { type: "string" } } },
            },
          }
        : {}),
      "409": { $ref: "#/components/responses/Error" },
      "429": { $ref: "#/components/responses/Error" },
      "503": { $ref: "#/components/responses/Error" },
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
        TicketRecoveryInput: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
          },
        },
        ReservationInput: {
          type: "object",
          required: ["items"],
          properties: {
            turnstileToken: {
              type: "string",
              minLength: 1,
              maxLength: 2048,
              description:
                "Required when Turnstile is configured, including production. Widget action must be checkout.",
            },
            items: {
              type: "array",
              minItems: 1,
              description: "At most 10 tickets in total across all items.",
              items: {
                type: "object",
                required: ["ticketTypeId", "quantity"],
                properties: {
                  ticketTypeId: { type: "string", format: "uuid" },
                  quantity: { type: "integer", minimum: 1, maximum: 10 },
                },
              },
            },
            buyer: {
              type: "object",
              description:
                "Required for guests. Ignored for signed-in users, who reserve under their account.",
              required: ["email", "name"],
              properties: {
                email: { type: "string", format: "email" },
                name: { type: "string" },
              },
            },
          },
        },
        ReservationClaimInput: {
          type: "object",
          required: ["token"],
          properties: {
            token: {
              type: "string",
              description: "The reservation access token.",
            },
          },
        },
        ReservationLinkResetInput: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description:
                "A live reservation access token. Signed-in owners and admins can send an empty body.",
            },
          },
        },
        DeleteAccountInput: {
          type: "object",
          properties: {
            password: {
              type: "string",
              description:
                "Required when the account has a password. Google-only accounts leave it out.",
            },
          },
        },
        AddPasswordInput: {
          type: "object",
          required: ["newPassword"],
          properties: { newPassword: { type: "string", minLength: 8 } },
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
            slug: {
              type: "string",
              maxLength: 100,
              pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
              description:
                "Optional on creation. Generated from the title and kept stable when the title changes. Editable on drafts. Must be unique.",
            },
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
