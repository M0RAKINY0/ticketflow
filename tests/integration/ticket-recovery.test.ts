import request from "supertest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { createApp } from "../../src/app.js";
import * as authRuntime from "../../src/infrastructure/auth.js";
import * as redisModule from "../../src/infrastructure/redis.js";
afterEach(() => vi.restoreAllMocks());
describe("ticket recovery", () => {
  it("queues normalized emails with the same reply and no reservation data", async () => {
    const enqueue = vi
      .spyOn(authRuntime, "enqueueAccountEmail")
      .mockResolvedValue();
    vi.spyOn(redisModule, "allowRecoveryEmail").mockResolvedValue(true);
    const app = createApp();
    const first = await request(app)
      .post("/api/v1/reservations/recover")
      .send({ email: " Buyer@Example.com " });
    const second = await request(app)
      .post("/api/v1/reservations/recover")
      .send({ email: "absent@example.com" });
    expect(first.status).toBe(202);
    expect(second.body).toEqual(first.body);
    expect(JSON.stringify(first.body)).not.toMatch(/token|reservationId/);
    expect(enqueue).toHaveBeenCalledWith({
      kind: "ticket-recovery",
      email: "buyer@example.com",
    });
  });
  it("silently suppresses excess email requests", async () => {
    const enqueue = vi
      .spyOn(authRuntime, "enqueueAccountEmail")
      .mockResolvedValue();
    vi.spyOn(redisModule, "allowRecoveryEmail").mockResolvedValue(false);
    const response = await request(createApp())
      .post("/api/v1/reservations/recover")
      .send({ email: "buyer@example.com" });
    expect(response.status).toBe(202);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
