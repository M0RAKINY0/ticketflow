import { describe, it, expect, vi, afterEach } from "vitest";
import { prisma } from "../../src/infrastructure/prisma.js";
import {
  createNotificationProducer,
  createNotificationProcessor,
} from "../../src/modules/notifications/account-email.js";
import { isReservationAccessToken } from "../../src/utilities/reservation-access.js";
afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: "account-email-test-" } },
  });
});
describe("queued ticket recovery", () => {
  it("sends only the requested buyer's reservation links and no email for an unknown buyer", async () => {
    const owner = await prisma.user.create({
      data: { email: "account-email-test-owner@example.com", name: "Owner" },
    });
    const event = await prisma.event.create({
      data: {
        organizerId: owner.id,
        slug: "recovery-worker-test",
        title: "Show",
        description: "Show",
        venue: "Venue",
        category: "MUSIC",
        city: "Lagos",
        countryCode: "NG",
        currency: "NGN",
        timezone: "Africa/Lagos",
        startsAt: new Date("2030-01-01"),
        endsAt: new Date("2030-01-02"),
      },
    });
    const expected = await prisma.reservation.create({
      data: {
        eventId: event.id,
        buyerEmail: "buyer@example.com",
        buyerName: "Buyer",
        idempotencyKey: "one",
      },
    });
    await prisma.reservation.create({
      data: {
        eventId: event.id,
        buyerEmail: "other@example.com",
        buyerName: "Other",
        idempotencyKey: "two",
      },
    });
    const queue = { add: vi.fn() };
    const sender = { sendPasswordReset: vi.fn(), sendRecovery: vi.fn() };
    const secret = "s".repeat(32);
    const producer = createNotificationProducer(queue, secret);
    const processor = createNotificationProcessor({ secret, sender });
    await producer.enqueue({
      kind: "ticket-recovery",
      email: "buyer@example.com",
    });
    const [name, data] = queue.add.mock.calls[0];
    await processor({ id: "recovery-request", name, data } as never);
    expect(sender.sendRecovery).toHaveBeenCalledTimes(1);
    const [email, links] = sender.sendRecovery.mock.calls[0];
    expect(email).toBe("buyer@example.com");
    expect(links).toHaveLength(1);
    const url = new URL(links[0].url);
    expect(url.pathname).toContain(expected.id);
    expect(
      isReservationAccessToken(expected.id, url.searchParams.get("token")!),
    ).toBe(true);
    sender.sendRecovery.mockClear();
    await producer.enqueue({
      kind: "ticket-recovery",
      email: "unknown@example.com",
    });
    const [unknownName, unknownData] = queue.add.mock.calls[1];
    await processor({
      id: "unknown-request",
      name: unknownName,
      data: unknownData,
    } as never);
    expect(sender.sendRecovery).not.toHaveBeenCalled();
  });
});
