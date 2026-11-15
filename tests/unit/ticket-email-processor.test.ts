import { describe, it, expect, vi } from "vitest";
import { createTicketEmailProcessor } from "../../src/modules/notifications/ticket-email.processor.js";
import { createTicketEmailSender } from "../../src/infrastructure/email.js";
const reservationId = "9b0a3c4e-6c0f-4f0b-8d3b-0f6f2a1f5c11";
function setup(overrides = {}) {
  const delivery = {
    id: reservationId,
    confirmationSentAt: null,
    status: "CONFIRMED",
    buyerName: "Ada <script>",
    buyerEmail: "ada@example.com",
    event: {
      title: "Music & Food",
      startsAt: new Date("2030-06-15"),
      timezone: "Africa/Lagos",
      status: "PUBLISHED",
    },
    tickets: ["first", "second"].map((id) => ({
      id,
      publicId: id,
      status: "READY",
      qrCodeDataUrl: "data:image/png;base64,cG5n",
      ticketType: { name: "VIP" },
    })),
    ...overrides,
  };
  const send = vi.fn().mockResolvedValue({ data: {}, error: null });
  const repository = {
    findDelivery: vi.fn().mockResolvedValue(delivery),
    markSent: vi.fn(),
  };
  const processor = createTicketEmailProcessor({
    repository,
    sender: createTicketEmailSender({ from: "tickets@example.com", send }),
    reservationUrl: (id) => `https://ventra.example/reservations/${id}`,
  });
  return { processor, repository, send };
}
const job = {
  name: "send-ticket-confirmation",
  data: { reservationId },
} as never;
describe("reservation confirmation", () => {
  it("sends one email with every QR code and reservation idempotency", async () => {
    const { processor, send, repository } = setup();
    await processor(job);
    expect(send).toHaveBeenCalledTimes(1);
    const [message, options] = send.mock.calls[0]!;
    expect(
      message.attachments.filter((a: { contentId?: string }) => !a.contentId),
    ).toHaveLength(2);
    expect(message.html).toContain("cid:ticket-qr-first");
    expect(message.html).toContain("cid:ticket-qr-second");
    expect(message.html).not.toContain("<script>");
    expect(options).toEqual({
      idempotencyKey: `reservation-confirmation/${reservationId}`,
    });
    expect(repository.markSent).toHaveBeenCalledWith(
      reservationId,
      expect.any(Date),
    );
  });
  it.each([
    { confirmationSentAt: new Date() },
    { status: "CANCELLED" },
    { event: { status: "CANCELLED" } },
  ])("skips delivered or cancelled orders %j", async (overrides) => {
    const { processor, send } = setup(overrides);
    await processor(job);
    expect(send).not.toHaveBeenCalled();
  });
  it("does not mark delivery after a provider failure", async () => {
    const { processor, send, repository } = setup();
    send.mockResolvedValue({ error: { message: "down" } });
    await expect(processor(job)).rejects.toThrow("Email delivery failed");
    expect(repository.markSent).not.toHaveBeenCalled();
  });
  it("waits for all QR codes before sending", async () => {
    const { processor, send } = setup({ tickets: [{ qrCodeDataUrl: null }] });
    await expect(processor(job)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
