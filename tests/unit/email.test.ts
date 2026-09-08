import { describe, expect, it } from "vitest";

import {
  createTicketEmailSender,
  createVerificationEmailSender,
} from "../../src/infrastructure/email.js";

describe("verification email", () => {
  it("sends the OTP without leaking provider details on failure", async () => {
    const messages: unknown[] = [];
    const sender = createVerificationEmailSender({
      from: "Ventra <auth@example.com>",
      send: async (message) => {
        messages.push(message);
        return { data: { id: "email-1" }, error: null };
      },
    });

    await sender.sendVerificationOtp("person@example.com", "123456");
    expect(messages[0]).toMatchObject({
      from: "Ventra <auth@example.com>",
      to: "person@example.com",
      subject: "Verify your Ventra email",
    });
    expect(JSON.stringify(messages[0])).toContain("123456");

    const failing = createVerificationEmailSender({
      from: "Ventra <auth@example.com>",
      send: async () => ({ data: null, error: { message: "provider detail" } }),
    });
    await expect(
      failing.sendVerificationOtp("secret@example.com", "654321"),
    ).rejects.toThrow("Email delivery failed");
  });
});

describe("ticket email", () => {
  it("sends the ticket QR inline and as a PNG attachment with an idempotency key", async () => {
    const deliveries: Array<{ message: unknown; options: unknown }> = [];
    const sender = createTicketEmailSender({
      from: "Ventra <tickets@example.com>",
      send: async (message, options) => {
        deliveries.push({ message, options });
        return { data: { id: "email-2" }, error: null };
      },
    });

    await sender.sendTicket({
      ticketId: "4c8fd57d-a993-4bd7-9943-4a6e22f913aa",
      publicId: "ticket-public-reference",
      recipientEmail: "attendee@example.com",
      attendeeName: "Ada Lovelace",
      eventName: "Ventra Live",
      eventStartsAt: new Date("2030-06-15T18:30:00.000Z"),
      eventTimezone: "Africa/Lagos",
      ticketTypeName: "General admission",
      qrCodeDataUrl: "data:image/png;base64,cG5nLWJ5dGVz",
    });

    expect(deliveries).toEqual([
      {
        message: expect.objectContaining({
          from: "Ventra <tickets@example.com>",
          to: "attendee@example.com",
          subject: "Your ticket for Ventra Live",
          attachments: [
            {
              content: "cG5nLWJ5dGVz",
              filename: "ventra-ticket-ticket-public-reference-inline.png",
              contentId: "ticket-qr",
            },
            {
              content: "cG5nLWJ5dGVz",
              filename: "ventra-ticket-ticket-public-reference.png",
            },
          ],
        }),
        options: {
          idempotencyKey:
            "ticket-confirmation/4c8fd57d-a993-4bd7-9943-4a6e22f913aa",
        },
      },
    ]);
    expect(JSON.stringify(deliveries[0]?.message)).toContain("cid:ticket-qr");
    expect(JSON.stringify(deliveries[0]?.message)).toContain("Ada Lovelace");
    expect(JSON.stringify(deliveries[0]?.message)).toContain(
      "General admission",
    );
    expect(JSON.stringify(deliveries[0]?.message)).toContain("15 June 2030");
  });

  it("escapes attendee and event data before placing it in HTML", async () => {
    const messages: Array<{ html: string }> = [];
    const sender = createTicketEmailSender({
      from: "Ventra <tickets@example.com>",
      send: async (message) => {
        messages.push(message);
        return { data: { id: "email-3" }, error: null };
      },
    });

    await sender.sendTicket({
      ticketId: "4c8fd57d-a993-4bd7-9943-4a6e22f913aa",
      publicId: "ticket-reference",
      recipientEmail: "attendee@example.com",
      attendeeName: "Ada <script>alert(1)</script>",
      eventName: "Music & <b>Food</b>",
      eventStartsAt: new Date("2030-06-15T18:30:00.000Z"),
      eventTimezone: "Africa/Lagos",
      ticketTypeName: "General > VIP",
      qrCodeDataUrl: "data:image/png;base64,cG5nLWJ5dGVz",
    });

    expect(messages[0]?.html).not.toContain("<script>");
    expect(messages[0]?.html).not.toContain("<b>");
    expect(messages[0]?.html).toContain("Music &amp; &lt;b&gt;Food&lt;/b&gt;");
    expect(messages[0]?.html).toContain("General &gt; VIP");
  });
});
