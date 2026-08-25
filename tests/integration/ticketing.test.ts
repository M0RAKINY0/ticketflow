import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { prisma } from "../../src/infrastructure/prisma.js";
import { signAccessToken } from "../../src/utilities/token.js";

const TEST_EMAIL_PREFIX = "ticketing-test-";
const futureStart = "2030-06-01T18:00:00.000Z";
const futureEnd = "2030-06-01T22:00:00.000Z";

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
});

async function createUser(label: string, role: "USER" | "ADMIN") {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}${label}@example.com`,
      name: `${label} user`,
      phoneNumber: "+2348000000000",
      passwordHash: "unused-in-ticketing-tests",
      role,
    },
  });

  return { user, token: signAccessToken(user) };
}

function authorization(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function createEvent(token: string, title = "Lagos Live") {
  return request(createApp())
    .post("/api/v1/events")
    .set(authorization(token))
    .send({
      title,
      description: "An evening of live music.",
      startsAt: futureStart,
      endsAt: futureEnd,
      venue: "Civic Centre",
      category: "MUSIC",
      coverImageUrl: "https://images.example.com/lagos-live.jpg",
      city: "Lagos",
      countryCode: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
    });
}

async function createTicketType(
  token: string,
  eventId: string,
  overrides = {},
) {
  return request(createApp())
    .post(`/api/v1/events/${eventId}/ticket-types`)
    .set(authorization(token))
    .send({
      name: "General Admission",
      description: "Standing access",
      price: 7500,
      capacity: 2,
      ...overrides,
    });
}

async function publishEvent(token: string, eventId: string) {
  return request(createApp())
    .post(`/api/v1/events/${eventId}/publish`)
    .set(authorization(token));
}

async function reserve(
  token: string,
  eventId: string,
  ticketTypeId: string,
  key: string,
) {
  return request(createApp())
    .post(`/api/v1/events/${eventId}/reservations`)
    .set(authorization(token))
    .set("Idempotency-Key", key)
    .send({ ticketTypeId });
}

describe("event and ticket type management", () => {
  it("keeps drafts private, enforces ownership, and exposes a published event publicly", async () => {
    const owner = await createUser("event-owner", "USER");
    const otherUser = await createUser("other-user", "USER");
    const created = await createEvent(owner.token);
    const eventId = created.body.data.event.id as string;

    const publicDraftList = await request(createApp()).get("/api/v1/events");
    const publicDraftDetail = await request(createApp()).get(
      `/api/v1/events/${eventId}`,
    );
    const ownerDraftList = await request(createApp())
      .get("/api/v1/events")
      .set(authorization(owner.token));
    const forbiddenUpdate = await request(createApp())
      .patch(`/api/v1/events/${eventId}`)
      .set(authorization(otherUser.token))
      .send({ title: "Stolen title" });
    const emptyPublish = await publishEvent(owner.token, eventId);
    const ticketType = await createTicketType(owner.token, eventId);
    const updated = await request(createApp())
      .patch(`/api/v1/events/${eventId}`)
      .set(authorization(owner.token))
      .send({ venue: "Eko Hotel" });
    const published = await publishEvent(owner.token, eventId);
    const publicPublishedList =
      await request(createApp()).get("/api/v1/events");
    const publicPublishedDetail = await request(createApp()).get(
      `/api/v1/events/${eventId}`,
    );

    expect(created.status).toBe(201);
    expect(created.body.data.event).toMatchObject({
      title: "Lagos Live",
      status: "DRAFT",
      organizerId: owner.user.id,
      category: "MUSIC",
      coverImageUrl: "https://images.example.com/lagos-live.jpg",
      city: "Lagos",
      countryCode: "NG",
      currency: "NGN",
      timezone: "Africa/Lagos",
    });
    expect(publicDraftList.body.data).toMatchObject({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    expect(publicDraftDetail.status).toBe(404);
    expect(ownerDraftList.body.data.items).toEqual([
      expect.objectContaining({ id: eventId, status: "DRAFT" }),
    ]);
    expect(forbiddenUpdate.status).toBe(403);
    expect(emptyPublish.status).toBe(409);
    expect(emptyPublish.body.error.code).toBe("EVENT_HAS_NO_TICKET_TYPES");
    expect(ticketType.status).toBe(201);
    expect(updated.body.data.event.venue).toBe("Eko Hotel");
    expect(published.status).toBe(200);
    expect(published.body.data.event.status).toBe("PUBLISHED");
    expect(publicPublishedList.body.data.items).toEqual([
      expect.objectContaining({ id: eventId, status: "PUBLISHED" }),
    ]);
    expect(publicPublishedDetail.body.data.event.id).toBe(eventId);
  });

  it("lets an admin manage an event owned by another user", async () => {
    const owner = await createUser("admin-managed-owner", "USER");
    const admin = await createUser("admin-managed-admin", "ADMIN");
    const created = await createEvent(owner.token, "Admin Managed Event");
    const eventId = created.body.data.event.id as string;

    const updated = await request(createApp())
      .patch(`/api/v1/events/${eventId}`)
      .set(authorization(admin.token))
      .send({ title: "Admin Updated Event" });

    expect(updated.status).toBe(200);
    expect(updated.body.data.event).toMatchObject({
      id: eventId,
      title: "Admin Updated Event",
      organizerId: owner.user.id,
    });
  });

  it("creates, updates, lists, and deletes ticket types only while an owned event is a draft", async () => {
    const owner = await createUser("ticket-type-owner", "USER");
    const otherUser = await createUser("ticket-type-other", "USER");
    const createdEvent = await createEvent(owner.token, "Ticket Types");
    const eventId = createdEvent.body.data.event.id as string;
    const createdType = await createTicketType(owner.token, eventId);
    const ticketTypeId = createdType.body.data.ticketType.id as string;

    const privateList = await request(createApp())
      .get(`/api/v1/events/${eventId}/ticket-types`)
      .set(authorization(owner.token));
    const forbidden = await request(createApp())
      .patch(`/api/v1/events/${eventId}/ticket-types/${ticketTypeId}`)
      .set(authorization(otherUser.token))
      .send({ capacity: 5 });
    const updated = await request(createApp())
      .patch(`/api/v1/events/${eventId}/ticket-types/${ticketTypeId}`)
      .set(authorization(owner.token))
      .send({ name: "VIP", price: 12000, capacity: 4 });
    const secondType = await createTicketType(owner.token, eventId, {
      name: "Balcony",
      capacity: 1,
    });
    const secondTypeId = secondType.body.data.ticketType.id as string;
    const removed = await request(createApp())
      .delete(`/api/v1/events/${eventId}/ticket-types/${secondTypeId}`)
      .set(authorization(owner.token));
    await publishEvent(owner.token, eventId);
    const publicList = await request(createApp()).get(
      `/api/v1/events/${eventId}/ticket-types`,
    );
    const lockedCreate = await createTicketType(owner.token, eventId, {
      name: "Late Type",
    });
    const lockedUpdate = await request(createApp())
      .patch(`/api/v1/events/${eventId}/ticket-types/${ticketTypeId}`)
      .set(authorization(owner.token))
      .send({ capacity: 8 });
    const lockedDelete = await request(createApp())
      .delete(`/api/v1/events/${eventId}/ticket-types/${ticketTypeId}`)
      .set(authorization(owner.token));

    expect(privateList.body.data.ticketTypes).toHaveLength(1);
    expect(forbidden.status).toBe(403);
    expect(updated.body.data.ticketType).toMatchObject({
      name: "VIP",
      capacity: 4,
    });
    expect(updated.body.data.ticketType.price).toBe("12000");
    expect(removed.status).toBe(204);
    expect(publicList.body.data.ticketTypes).toEqual([
      expect.objectContaining({ id: ticketTypeId, name: "VIP" }),
    ]);
    expect(lockedCreate.status).toBe(409);
    expect(lockedUpdate.status).toBe(409);
    expect(lockedDelete.status).toBe(409);
  });

  it("cancels an owned event and removes it from public discovery", async () => {
    const owner = await createUser("cancel-owner", "USER");
    const created = await createEvent(owner.token, "Cancelled Show");
    const eventId = created.body.data.event.id as string;
    await createTicketType(owner.token, eventId);
    await publishEvent(owner.token, eventId);

    const cancelled = await request(createApp())
      .post(`/api/v1/events/${eventId}/cancel`)
      .set(authorization(owner.token));
    const publicDetail = await request(createApp()).get(
      `/api/v1/events/${eventId}`,
    );

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.event.status).toBe("CANCELLED");
    expect(publicDetail.status).toBe(404);
  });

  it("rejects invalid global event data", async () => {
    const owner = await createUser("invalid-global-owner", "USER");
    const invalidCases = [
      { coverImageUrl: "http://images.example.com/event.jpg" },
      { timezone: "Mars/Olympus_Mons" },
      { currency: "NAIRA" },
      { currency: "ZZZ" },
      { countryCode: "NGA" },
      { countryCode: "ZZ" },
      { endsAt: futureStart },
    ];

    for (const invalid of invalidCases) {
      const response = await request(createApp())
        .post("/api/v1/events")
        .set(authorization(owner.token))
        .send({
          title: "Invalid global event",
          description: "This event must not be persisted.",
          startsAt: futureStart,
          endsAt: futureEnd,
          venue: "Test venue",
          category: "TECHNOLOGY",
          coverImageUrl: "https://images.example.com/event.jpg",
          city: "Lagos",
          countryCode: "NG",
          currency: "NGN",
          timezone: "Africa/Lagos",
          ...invalid,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("filters and paginates public events while retaining owner draft visibility", async () => {
    const lagosOwner = await createUser("discovery-lagos-owner", "USER");
    const londonOwner = await createUser("discovery-london-owner", "USER");
    const lagosEvent = await createEvent(lagosOwner.token, "Lagos Jazz Night");
    const londonEvent = await request(createApp())
      .post("/api/v1/events")
      .set(authorization(londonOwner.token))
      .send({
        title: "London Product Forum",
        description: "A business gathering.",
        startsAt: "2030-07-01T08:00:00.000Z",
        endsAt: "2030-07-01T17:00:00.000Z",
        venue: "Barbican Centre",
        category: "BUSINESS",
        city: "London",
        countryCode: "GB",
        currency: "GBP",
        timezone: "Europe/London",
      });

    await createTicketType(lagosOwner.token, lagosEvent.body.data.event.id);
    await createTicketType(londonOwner.token, londonEvent.body.data.event.id);
    await publishEvent(lagosOwner.token, lagosEvent.body.data.event.id);
    await publishEvent(londonOwner.token, londonEvent.body.data.event.id);
    const draft = await createEvent(
      lagosOwner.token,
      "Lagos Private Rehearsal",
    );

    const publicFiltered = await request(createApp())
      .get("/api/v1/events")
      .query({
        query: "lagos",
        category: "MUSIC",
        countryCode: "ng",
        from: "2030-01-01T00:00:00.000Z",
        to: "2030-12-31T23:59:59.000Z",
        page: 1,
        pageSize: 1,
      });
    const ownerList = await request(createApp())
      .get("/api/v1/events")
      .query({ page: 1, pageSize: 10 })
      .set(authorization(lagosOwner.token));
    const invalidPageSize = await request(createApp())
      .get("/api/v1/events")
      .query({ pageSize: 101 });

    expect(publicFiltered.status).toBe(200);
    expect(publicFiltered.body.data).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
    });
    expect(publicFiltered.body.data.items).toEqual([
      expect.objectContaining({
        id: lagosEvent.body.data.event.id,
        category: "MUSIC",
        countryCode: "NG",
      }),
    ]);
    expect(ownerList.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lagosEvent.body.data.event.id,
          status: "PUBLISHED",
        }),
        expect.objectContaining({
          id: draft.body.data.event.id,
          status: "DRAFT",
        }),
      ]),
    );
    expect(ownerList.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: londonEvent.body.data.event.id }),
      ]),
    );
    expect(invalidPageSize.status).toBe(400);
  });
});

describe("reservations and attendee tickets", () => {
  it("creates one durable QR ticket and replays an idempotent reservation without consuming inventory twice", async () => {
    const owner = await createUser("reservation-owner", "USER");
    const attendee = await createUser("reservation-attendee", "USER");
    const createdEvent = await createEvent(owner.token, "Idempotent Show");
    const eventId = createdEvent.body.data.event.id as string;
    const createdType = await createTicketType(owner.token, eventId, {
      capacity: 2,
    });
    const ticketTypeId = createdType.body.data.ticketType.id as string;
    await publishEvent(owner.token, eventId);

    const first = await reserve(
      attendee.token,
      eventId,
      ticketTypeId,
      "reserve-once",
    );
    const replay = await reserve(
      attendee.token,
      eventId,
      ticketTypeId,
      "reserve-once",
    );
    const reservationId = first.body.data.reservation.id as string;
    const ticketId = first.body.data.reservation.ticket.id as string;
    const storedTicket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    const storedType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketTypeId },
    });
    const reservations = await request(createApp())
      .get("/api/v1/me/reservations")
      .set(authorization(attendee.token));
    const tickets = await request(createApp())
      .get("/api/v1/me/tickets")
      .set(authorization(attendee.token));
    const ticket = await request(createApp())
      .get(`/api/v1/me/tickets/${ticketId}`)
      .set(authorization(attendee.token));
    const qr = await request(createApp())
      .get(`/api/v1/me/tickets/${ticketId}/qr`)
      .set(authorization(attendee.token));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.data.reservation.id).toBe(reservationId);
    expect(first.body.data.reservation.ticket.status).toBe("READY");
    expect(first.body.data.reservation.ticket.qrPayload).toMatch(
      /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/,
    );
    expect(first.body.data.reservation.ticket.qrPayload).not.toContain(
      attendee.user.id,
    );
    expect(first.body.data.reservation.ticket.qrPayload).not.toContain(eventId);
    expect(storedTicket.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(storedType.reservedCount).toBe(1);
    expect(reservations.body.data.reservations).toEqual([
      expect.objectContaining({ id: reservationId }),
    ]);
    expect(tickets.body.data.tickets).toEqual([
      expect.objectContaining({ id: ticketId }),
    ]);
    expect(ticket.body.data.ticket.id).toBe(ticketId);
    expect(qr.body.data.qrCodeDataUrl).toBe(storedTicket.qrCodeDataUrl);
  });

  it("never exceeds capacity under concurrent reservations", async () => {
    const owner = await createUser("capacity-owner", "USER");
    const firstAttendee = await createUser("capacity-first", "USER");
    const secondAttendee = await createUser("capacity-second", "USER");
    const createdEvent = await createEvent(owner.token, "Capacity Show");
    const eventId = createdEvent.body.data.event.id as string;
    const createdType = await createTicketType(owner.token, eventId, {
      capacity: 1,
    });
    const ticketTypeId = createdType.body.data.ticketType.id as string;
    await publishEvent(owner.token, eventId);

    const responses = await Promise.all([
      reserve(firstAttendee.token, eventId, ticketTypeId, "capacity-a"),
      reserve(secondAttendee.token, eventId, ticketTypeId, "capacity-b"),
    ]);
    const storedType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketTypeId },
    });

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.error.code,
    ).toBe("TICKET_TYPE_SOLD_OUT");
    expect(storedType.reservedCount).toBe(1);
  });

  it("rejects an idempotency key reused for a different reservation request", async () => {
    const owner = await createUser("key-owner", "USER");
    const attendee = await createUser("key-attendee", "USER");
    const createdEvent = await createEvent(owner.token, "Key Show");
    const eventId = createdEvent.body.data.event.id as string;
    const firstType = await createTicketType(owner.token, eventId, {
      name: "First",
    });
    const secondType = await createTicketType(owner.token, eventId, {
      name: "Second",
    });
    await publishEvent(owner.token, eventId);

    await reserve(
      attendee.token,
      eventId,
      firstType.body.data.ticketType.id,
      "same-key",
    );
    const conflict = await reserve(
      attendee.token,
      eventId,
      secondType.body.data.ticketType.id,
      "same-key",
    );

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("ticket check-in", () => {
  it("allows the event owner or an admin to list check-ins and consumes a ticket exactly once", async () => {
    const owner = await createUser("checkin-owner", "USER");
    const otherUser = await createUser("checkin-other", "USER");
    const attendee = await createUser("checkin-attendee", "USER");
    const admin = await createUser("checkin-admin", "ADMIN");
    const createdEvent = await createEvent(owner.token, "Check-in Show");
    const eventId = createdEvent.body.data.event.id as string;
    const createdType = await createTicketType(owner.token, eventId, {
      capacity: 1,
    });
    const ticketTypeId = createdType.body.data.ticketType.id as string;
    await publishEvent(owner.token, eventId);
    const reservation = await reserve(
      attendee.token,
      eventId,
      ticketTypeId,
      "checkin-ticket",
    );
    const qrPayload = reservation.body.data.reservation.ticket
      .qrPayload as string;

    const forbidden = await request(createApp())
      .post(`/api/v1/events/${eventId}/check-ins`)
      .set(authorization(otherUser.token))
      .send({ qrPayload });
    const attempts = await Promise.all([
      request(createApp())
        .post(`/api/v1/events/${eventId}/check-ins`)
        .set(authorization(owner.token))
        .send({ qrPayload }),
      request(createApp())
        .post(`/api/v1/events/${eventId}/check-ins`)
        .set(authorization(admin.token))
        .send({ qrPayload }),
    ]);
    const ownerList = await request(createApp())
      .get(`/api/v1/events/${eventId}/check-ins`)
      .set(authorization(owner.token));
    const adminList = await request(createApp())
      .get(`/api/v1/events/${eventId}/check-ins`)
      .set(authorization(admin.token));
    const replacement = qrPayload.endsWith("0") ? "1" : "0";
    const invalidQr = await request(createApp())
      .post(`/api/v1/events/${eventId}/check-ins`)
      .set(authorization(owner.token))
      .send({ qrPayload: `${qrPayload.slice(0, -1)}${replacement}` });

    expect(forbidden.status).toBe(403);
    expect(attempts.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      attempts.find((response) => response.status === 409)?.body.error.code,
    ).toBe("TICKET_ALREADY_USED");
    expect(ownerList.body.data.checkIns).toHaveLength(1);
    expect(adminList.body.data.checkIns).toHaveLength(1);
    expect(invalidQr.status).toBe(400);
    expect(invalidQr.body.error.code).toBe("INVALID_QR_PAYLOAD");
  }, 15_000);
});
