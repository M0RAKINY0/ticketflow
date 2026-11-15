import { prisma } from "../../infrastructure/prisma.js";

export type TicketEmailDelivery = {
  id: string;
  publicId: string;
  qrCodeDataUrl: string | null;
  emailSentAt: Date | null;
  ticketType: { name: string };
  reservation: {
    id: string;
    buyerEmail: string;
    buyerName: string;
    event: { title: string; startsAt: Date; timezone: string };
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
        ticketType: { select: { name: true } },
        reservation: {
          select: {
            id: true,
            buyerEmail: true,
            buyerName: true,
            event: { select: { title: true, startsAt: true, timezone: true } },
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
