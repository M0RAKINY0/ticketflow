import { UnrecoverableError, type Job } from "bullmq";

import type { TicketEmailSender } from "../../infrastructure/email.js";
import { parseTicketEmailJob } from "../../infrastructure/queues/contracts.js";
import type { TicketEmailRepository } from "./ticket-email.repository.js";

export type { TicketEmailRepository } from "./ticket-email.repository.js";

export function createTicketEmailProcessor({
  repository,
  sender,
  reservationUrl,
  clock = () => new Date(),
}: {
  repository: TicketEmailRepository;
  sender: TicketEmailSender;
  /** Builds the link a buyer follows to see every ticket in the reservation. */
  reservationUrl: (reservationId: string) => string;
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

    const delivery = await repository.findDelivery(payload.reservationId);
    if (!delivery) {
      throw new UnrecoverableError("Ticket email target does not exist");
    }
    if (
      delivery.confirmationSentAt ||
      delivery.status !== "CONFIRMED" ||
      delivery.event.status === "CANCELLED"
    )
      return;
    if (
      !delivery.tickets.length ||
      delivery.tickets.some(
        (ticket) => !ticket.qrCodeDataUrl || ticket.status === "VOID",
      )
    ) {
      throw new UnrecoverableError("Ticket QR code is not ready");
    }

    await sender.sendTicket({
      reservationId: delivery.id,
      recipientEmail: delivery.buyerEmail,
      attendeeName: delivery.buyerName,
      eventName: delivery.event.title,
      eventStartsAt: delivery.event.startsAt,
      eventTimezone: delivery.event.timezone,
      tickets: delivery.tickets.map((ticket) => ({
        publicId: ticket.publicId,
        ticketTypeName: ticket.ticketType.name,
        qrCodeDataUrl: ticket.qrCodeDataUrl!,
      })),
      reservationUrl: reservationUrl(delivery.id),
    });
    await repository.markSent(delivery.id, clock());
  };
}
