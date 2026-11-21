import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/prisma.js";
import { issueTestJwt } from "../helpers/auth.js";

const PREFIX = "event-staff-test-";

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

async function user(label: string) {
  const created = await prisma.user.create({
    data: {
      email: `${PREFIX}${label}@example.com`,
      name: label,
      emailVerified: true,
    },
  });
  return { ...created, token: await issueTestJwt(created) };
}

describe("door staff", () => {
  it("lets added staff scan for one event until the organizer removes them", async () => {
    const app = createApp();
    const host = await user("host");
    const helper = await user("helper");
    const stranger = await user("stranger");
    const event = await prisma.event.create({
      data: {
        organizerId: host.id,
        slug: `${PREFIX}${host.id.slice(0, 8)}`,
        title: "Door test",
        description: "Door test",
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
    const checkIns = (token: string) =>
      request(app)
        .get(`/api/v1/events/${event.id}/check-ins`)
        .set("Authorization", `Bearer ${token}`);

    expect((await checkIns(helper.token)).status).toBe(403);

    const added = await request(app)
      .post(`/api/v1/events/${event.id}/staff`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({ email: helper.email.toUpperCase() });
    expect(added.status).toBe(201);
    expect(added.body.data.staff.userId).toBe(helper.id);

    expect((await checkIns(helper.token)).status).toBe(200);
    expect((await checkIns(stranger.token)).status).toBe(403);
    const mine = await request(app)
      .get("/api/v1/me/staff-events")
      .set("Authorization", `Bearer ${helper.token}`);
    expect(mine.body.data.events.map((e: { id: string }) => e.id)).toEqual([
      event.id,
    ]);

    // Staff scan; they don't manage the team.
    const staffAdding = await request(app)
      .post(`/api/v1/events/${event.id}/staff`)
      .set("Authorization", `Bearer ${helper.token}`)
      .send({ email: stranger.email });
    expect(staffAdding.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/v1/events/${event.id}/staff/${helper.id}`)
      .set("Authorization", `Bearer ${host.token}`);
    expect(removed.status).toBe(204);
    expect((await checkIns(helper.token)).status).toBe(403);
  });
});
