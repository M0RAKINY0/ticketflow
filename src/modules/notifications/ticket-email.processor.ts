import { UnrecoverableError, type Job } from "bullmq";

import type { TicketEmailSender } from "../../infrastructure/email.js";
import { parseTicketEmailJob } from "../../infrastructure/queues/contracts.js";
import type { TicketEmailRepository } from "./ticket-email.repository.js";

export type { TicketEmailRepository } from "./ticket-email.repository.js";

export function createTicketEmailProcessor({
  repository,
  sender,
  clock = () => new Date(),
}: {
  repository: TicketEmailRepository;
  sender: TicketEmailSender;
  clock?: () => Date;
}): (job: Job) => Promise<void> {
  return async (job) => {
    if (job.name !== "send-ticket-confirmation") {
      throw new UnrecoverableError("Unsupported ticket email job");
    }

    let payload;
    try {
      payload = parseTicketEmailJob(job.data);
    } catch {
      throw new UnrecoverableError("Ticket email job payload is invalid");
    }

    const delivery = await repository.findDelivery(payload.ticketId);
    if (!delivery) {
      throw new UnrecoverableError("Ticket email target does not exist");
    }
    if (delivery.emailSentAt) return;
    if (!delivery.qrCodeDataUrl) {
      throw new UnrecoverableError("Ticket QR code is not ready");
    }

    await sender.sendTicket({
      ticketId: delivery.id,
      publicId: delivery.publicId,
      recipientEmail: delivery.reservation.user.email,
      attendeeName: delivery.reservation.user.name,
      eventName: delivery.reservation.event.title,
      eventStartsAt: delivery.reservation.event.startsAt,
      eventTimezone: delivery.reservation.event.timezone,
      ticketTypeName: delivery.reservation.ticketType.name,
      qrCodeDataUrl: delivery.qrCodeDataUrl,
    });
    await repository.markSent(delivery.id, clock());
  };
}
