import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/prisma.js";

const password = "Correct-Horse-42";
const created: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.splice(0) } } });
});

async function signUp(email: string) {
  const response = await request(createApp())
    .post("/api/v1/auth/sign-up/email")
    .send({ email, name: "Host Person", password });
  const header = response.headers["set-cookie"];
  const cookie = (Array.isArray(header) ? header[0] : header)!.split(";")[0]!;
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  created.push(user.id);
  return { cookie, user };
}

describe("DELETE /api/v1/me", () => {
  it("waits while a hosted event is live, then scrubs the account and keeps the records", async () => {
    const app = createApp();
    const { cookie, user } = await signUp("account-deletion-host@example.com");
    const event = await prisma.event.create({
      data: {
        organizerId: user.id,
        slug: `account-deletion-${user.id.slice(0, 8)}`,
        title: "Show",
        description: "Show",
        venue: "Venue",
        category: "MUSIC",
        city: "Lagos",
        countryCode: "NG",
        currency: "NGN",
        timezone: "Africa/Lagos",
        status: "PUBLISHED",
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
      },
    });
    const sold = await prisma.reservation.create({
      data: {
        eventId: event.id,
        buyerEmail: "someone-else@example.com",
        buyerName: "Someone Else",
        idempotencyKey: "sold",
      },
    });
    const own = await prisma.reservation.create({
      data: {
        eventId: event.id,
        userId: user.id,
        buyerEmail: user.email,
        buyerName: user.name,
        idempotencyKey: "own",
      },
    });

    const live = await request(app)
      .delete("/api/v1/me")
      .set("Cookie", cookie)
      .send({ password });
    expect(live.status).toBe(409);
    expect(live.body.error.code).toBe("ACCOUNT_HOSTS_LIVE_EVENTS");

    await prisma.event.update({
      where: { id: event.id },
      data: {
        startsAt: new Date(Date.now() - 90_000_000),
        endsAt: new Date(Date.now() - 86_400_000),
      },
    });
    const wrong = await request(app)
      .delete("/api/v1/me")
      .set("Cookie", cookie)
      .send({ password: "not-it" });
    expect(wrong.status).toBe(401);

    const deleted = await request(app)
      .delete("/api/v1/me")
      .set("Cookie", cookie)
      .send({ password });
    expect(deleted.status).toBe(204);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row).toMatchObject({
      name: "Deleted user",
      email: `deleted-${user.id}@deleted.invalid`,
      phoneNumber: null,
    });
    expect(row.deletedAt).not.toBeNull();
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(
      (await request(app).get("/api/v1/me").set("Cookie", cookie)).status,
    ).toBe(401);

    // The past event and the other buyer's order are untouched.
    expect(
      (await prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .status,
    ).toBe("PUBLISHED");
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: sold.id } }),
    ).toMatchObject({ buyerEmail: "someone-else@example.com" });
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: own.id } }),
    ).toMatchObject({
      buyerName: "Deleted user",
      buyerEmail: `deleted-${own.id}@deleted.invalid`,
    });
  });
});
