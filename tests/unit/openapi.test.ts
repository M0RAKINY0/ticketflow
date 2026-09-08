import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

const applicationOperations = [
  "GET /health",
  "GET /api/v1/me",
  "GET /api/v1/users",
  "PATCH /api/v1/users/{userId}/role",
  "GET /api/v1/events",
  "POST /api/v1/events",
  "GET /api/v1/events/{eventId}",
  "PATCH /api/v1/events/{eventId}",
  "POST /api/v1/events/{eventId}/publish",
  "POST /api/v1/events/{eventId}/cancel",
  "GET /api/v1/events/{eventId}/ticket-types",
  "POST /api/v1/events/{eventId}/ticket-types",
  "PATCH /api/v1/events/{eventId}/ticket-types/{ticketTypeId}",
  "DELETE /api/v1/events/{eventId}/ticket-types/{ticketTypeId}",
  "POST /api/v1/events/{eventId}/reservations",
  "GET /api/v1/me/reservations",
  "GET /api/v1/me/tickets",
  "GET /api/v1/me/tickets/{ticketId}",
  "GET /api/v1/me/tickets/{ticketId}/qr",
  "POST /api/v1/events/{eventId}/check-ins",
  "GET /api/v1/events/{eventId}/check-ins",
];

describe("OpenAPI documentation", () => {
  it("serves Swagger UI and covers every Ventra route", async () => {
    const app = createApp();
    const schema = await request(app).get("/api/openapi.json");
    const ui = await request(app).get("/api/docs/");

    expect(schema.status).toBe(200);
    expect(schema.body.openapi).toMatch(/^3\.1/);
    for (const operation of applicationOperations) {
      const [method, path] = operation.split(" ");
      expect(
        schema.body.paths[path!]?.[method!.toLowerCase()],
        operation,
      ).toBeTruthy();
    }
    expect(schema.body.paths["/api/v1/auth/sign-up/email"]).toBeTruthy();
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("Swagger UI");
    expect(ui.headers["content-security-policy"]).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
  });
});
