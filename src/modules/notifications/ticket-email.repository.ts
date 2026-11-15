import { prisma } from "../../infrastructure/prisma.js";
export type TicketEmailDelivery = {
  id: string;
  confirmationSentAt: Date | null;
  status: string;
  buyerEmail: string;
  buyerName: string;
  event: { title: string; startsAt: Date; timezone: string; status: string };
  tickets: Array<{
    id: string;
    publicId: string;
    qrCodeDataUrl: string | null;
    status: string;
    ticketType: { name: string };
  }>;
};
export type TicketEmailRepository = {
  findDelivery(reservationId: string): Promise<TicketEmailDelivery | null>;
  markSent(reservationId: string, sentAt: Date): Promise<void>;
};
export const ticketEmailRepository: TicketEmailRepository = {
  findDelivery: (reservationId) =>
    prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        confirmationSentAt: true,
        status: true,
        buyerEmail: true,
        buyerName: true,
        event: {
          select: { title: true, startsAt: true, timezone: true, status: true },
        },
        tickets: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            publicId: true,
            qrCodeDataUrl: true,
            status: true,
            ticketType: { select: { name: true } },
          },
        },
      },
    }),
  async markSent(reservationId, sentAt) {
    await prisma.$transaction([
      prisma.reservation.updateMany({
        where: { id: reservationId, confirmationSentAt: null },
        data: { confirmationSentAt: sentAt },
      }),
      prisma.ticket.updateMany({
        where: { reservationId, emailSentAt: null },
        data: { emailSentAt: sentAt },
      }),
    ]);
  },
};
