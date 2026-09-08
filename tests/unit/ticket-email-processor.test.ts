import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { createTicketEmailSender } from "../../src/infrastructure/email.js";
import {
  createTicketEmailProcessor,
  type TicketEmailRepository,
} from "../../src/modules/notifications/ticket-email.processor.js";

const ticketId = "4c8fd57d-a993-4bd7-9943-4a6e22f913aa";
const sentAt = new Date("2030-06-15T18:30:00.000Z");

function delivery(
  overrides: Partial<
    Awaited<ReturnType<TicketEmailRepository["findDelivery"]>>
  > = {},
) {
  return {
    id: ticketId,
    publicId: "ticket-public-reference",
    qrCodeDataUrl: "data:image/png;base64,cG5nLWJ5dGVz",
    emailSentAt: null,
    reservation: {
      user: { email: "attendee@example.com", name: "Ada Lovelace" },
      event: {
        title: "Ventra Live",
        startsAt: sentAt,
        timezone: "Africa/Lagos",
      },
      ticketType: { name: "General admission" },
    },
    ...overrides,
  };
}

function setup(ticket = delivery()) {
  const findDelivery = vi.fn().mockResolvedValue(ticket);
  const markSent = vi.fn().mockResolvedValue(undefined);
  const send = vi
    .fn()
    .mockResolvedValue({ data: { id: "email-1" }, error: null });
  const processor = createTicketEmailProcessor({
    repository: { findDelivery, markSent },
    sender: createTicketEmailSender({
      from: "Ventra <tickets@example.com>",
      send,
    }),
    clock: () => sentAt,
  });

  return { processor, findDelivery, markSent, send };
}

describe("ticket email processor", () => {
  it("sends the existing QR email and marks the same ticket as sent", async () => {
    const { processor, markSent, send } = setup();

    await processor({
      name: "send-ticket-confirmation",
      data: { ticketId },
    } as never);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "attendee@example.com",
        subject: "Your ticket for Ventra Live",
        attachments: [
          expect.objectContaining({ contentId: "ticket-qr" }),
          expect.objectContaining({
            filename: "ventra-ticket-ticket-public-reference.png",
          }),
        ],
      }),
      { idempotencyKey: `ticket-confirmation/${ticketId}` },
    );
    expect(markSent).toHaveBeenCalledWith(ticketId, sentAt);
  });

  it("does not resend an already delivered ticket", async () => {
    const { processor, markSent, send } = setup(
      delivery({ emailSentAt: sentAt }),
    );

    await processor({
      name: "send-ticket-confirmation",
      data: { ticketId },
    } as never);

    expect(send).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("rejects a missing ticket permanently", async () => {
    const { processor } = setup(null);

    await expect(
      processor({
        name: "send-ticket-confirmation",
        data: { ticketId },
      } as never),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "UnrecoverableError",
        message: "Ticket email target does not exist",
      }),
    );
  });

  it("rejects a ticket without a QR code permanently", async () => {
    const { processor, send } = setup(delivery({ qrCodeDataUrl: null }));

    await expect(
      processor({
        name: "send-ticket-confirmation",
        data: { ticketId },
      } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects unknown jobs and invalid data before reading or writing", async () => {
    const { processor, findDelivery, markSent } = setup();

    await expect(
      processor({ name: "unknown", data: { ticketId } } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(
      processor({
        name: "send-ticket-confirmation",
        data: { ticketId: "bad" },
      } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(findDelivery).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });

  it("keeps provider failures retryable", async () => {
    const { processor, markSent, send } = setup();
    send.mockResolvedValueOnce({
      data: null,
      error: { message: "recipient rejected" },
    });

    await expect(
      processor({
        name: "send-ticket-confirmation",
        data: { ticketId },
      } as never),
    ).rejects.toThrow("Email delivery failed");
    expect(markSent).not.toHaveBeenCalled();
  });
});
