import { prisma } from "../../infrastructure/prisma.js";

export type TicketEmailDelivery = {
  id: string;
  publicId: string;
  qrCodeDataUrl: string | null;
  emailSentAt: Date | null;
  reservation: {
    user: { email: string; name: string };
    event: { title: string; startsAt: Date; timezone: string };
    ticketType: { name: string };
  };
};

export type TicketEmailRepository = {
  findDelivery(ticketId: string): Promise<TicketEmailDelivery | null>;
  markSent(ticketId: string, sentAt: Date): Promise<void>;
};

export const ticketEmailRepository: TicketEmailRepository = {
  async findDelivery(ticketId) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        publicId: true,
        qrCodeDataUrl: true,
        emailSentAt: true,
        reservation: {
          select: {
            user: { select: { email: true, name: true } },
            event: { select: { title: true, startsAt: true, timezone: true } },
            ticketType: { select: { name: true } },
          },
        },
      },
    });
  },

  async markSent(ticketId, sentAt) {
    await prisma.ticket.updateMany({
      where: { id: ticketId, emailSentAt: null },
      data: { emailSentAt: sentAt },
    });
  },
};
