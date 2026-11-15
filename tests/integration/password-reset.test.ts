import request from "supertest";
import { describe, it, expect, afterEach, vi } from "vitest";
import { createAuth } from "../../src/infrastructure/auth.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/prisma.js";
afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: "reset-test-" } },
  });
});
describe("password reset", () => {
  it("queues a reset, consumes the token once, changes the password, and revokes sessions", async () => {
    const enqueue = vi.fn();
    const app = createApp(
      undefined,
      createAuth({
        notificationProducer: { enqueue },
        rateLimitEnabled: false,
      }),
    );
    const email = "reset-test-buyer@example.com";
    const password = "Original-password-123";
    const signup = await request(app)
      .post("/api/v1/auth/sign-up/email")
      .send({ email, name: "Buyer", password });
    const cookie = signup.headers["set-cookie"][0].split(";")[0];
    const known = await request(app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email, redirectTo: "http://localhost:5173/reset-password" });
    const unknown = await request(app)
      .post("/api/v1/auth/request-password-reset")
      .send({
        email: "reset-test-absent@example.com",
        redirectTo: "http://localhost:5173/reset-password",
      });
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const payload = enqueue.mock.calls[0][0];
    expect(payload.kind).toBe("password-reset");
    const token = new URL(payload.url).pathname.split("/").at(-1);
    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "New-password-456" });
    expect(reset.status).toBe(200);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/reset-password")
          .send({ token, newPassword: "Another-password-789" })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).get("/api/v1/auth/get-session").set("Cookie", cookie))
        .body,
    ).toBeNull();
    expect(
      (
        await request(app)
          .post("/api/v1/auth/sign-in/email")
          .send({ email, password: "New-password-456" })
      ).status,
    ).toBe(200);
  });
});
