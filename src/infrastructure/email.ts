import { Resend } from "resend";

import { env } from "../config/env.js";

type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    content: string;
    filename: string;
    contentId?: string;
  }>;
};

type EmailTransport = {
  from: string;
  send(
    message: EmailMessage,
    options?: { idempotencyKey: string },
  ): Promise<{ data: unknown; error: unknown }>;
};

export type VerificationEmailSender = {
  sendVerificationOtp(email: string, otp: string): Promise<void>;
};

export type TicketEmailInput = {
  reservationId: string;
  recipientEmail: string;
  attendeeName: string;
  eventName: string;
  eventStartsAt: Date;
  eventTimezone: string;
  reservationUrl: string;
  tickets: Array<{
    publicId: string;
    ticketTypeName: string;
    qrCodeDataUrl: string;
  }>;
};

export type TicketEmailSender = {
  sendTicket(input: TicketEmailInput): Promise<void>;
};

export function createVerificationEmailSender(
  transport: EmailTransport,
): VerificationEmailSender {
  return {
    async sendVerificationOtp(email, otp) {
      const result = await transport.send({
        from: transport.from,
        to: email,
        subject: "Your Ventra verification code",
        text: `Your Ventra verification code is ${otp}. It expires in 5 minutes. Ignore this email if you didn't ask for a code.`,
        html: `<p>Your Ventra verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes. Ignore this email if you didn't ask for a code.</p>`,
      });
      if (result.error) throw new Error("Email delivery failed");
    },
  };
}

export function createTicketEmailSender(
  transport: EmailTransport,
): TicketEmailSender {
  return {
    async sendTicket(input) {
      const eventDate = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: input.eventTimezone,
      }).format(input.eventStartsAt);
      const result = await transport.send(
        {
          from: transport.from,
          to: input.recipientEmail,
          subject: `Your tickets for ${input.eventName}`,
          text: [
            `Hello ${input.attendeeName},`,
            `Your tickets for ${input.eventName} are ready.`,
            `Event date: ${eventDate}`,
            ...input.tickets.map(
              (ticket) => `${ticket.ticketTypeName}: ${ticket.publicId}`,
            ),
            `View your reservation: ${input.reservationUrl}`,
          ].join("\n\n"),
          html: `<p>Hello ${escapeHtml(input.attendeeName)},</p><p>Your tickets for ${escapeHtml(input.eventName)} are ready.</p><p>Event date: ${eventDate}</p>${input.tickets.map((ticket) => `<p>${escapeHtml(ticket.ticketTypeName)}: ${escapeHtml(ticket.publicId)}</p><img src="cid:ticket-qr-${escapeHtml(ticket.publicId)}" alt="Ticket QR code">`).join("")}<p><a href="${escapeHtml(input.reservationUrl)}">View your reservation</a></p>`,
          attachments: input.tickets.flatMap((ticket) => [
            {
              content: ticket.qrCodeDataUrl.replace(
                /^data:image\/png;base64,/,
                "",
              ),
              filename: `ventra-ticket-${ticket.publicId}-inline.png`,
              contentId: `ticket-qr-${ticket.publicId}`,
            },
            {
              content: ticket.qrCodeDataUrl.replace(
                /^data:image\/png;base64,/,
                "",
              ),
              filename: `ventra-ticket-${ticket.publicId}.png`,
            },
          ]),
        },
        { idempotencyKey: `reservation-confirmation/${input.reservationId}` },
      );
      if (result.error) throw new Error("Email delivery failed");
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const resend = new Resend(env.RESEND_API_KEY);
const resendTransport: EmailTransport = {
  from: env.AUTH_EMAIL_FROM,
  send: (message, options) => resend.emails.send(message, options),
};

export const verificationEmailSender =
  createVerificationEmailSender(resendTransport);
export const ticketEmailSender = createTicketEmailSender(resendTransport);

export function createAccountEmailSender(transport: EmailTransport) {
  return {
    async sendPasswordReset(email: string, url: string, key: string) {
      const result = await transport.send(
        {
          from: transport.from,
          to: email,
          subject: "Reset your Ventra password",
          text: `Reset your password: ${url}\nThis link expires in 15 minutes. Ignore this email if you did not request it.`,
          html: `<p><a href="${escapeHtml(url)}">Reset your password</a></p><p>This link expires in 15 minutes. Ignore this email if you did not request it.</p>`,
        },
        { idempotencyKey: key },
      );
      if (result.error) throw new Error("Email delivery failed");
    },
    async sendRecovery(
      email: string,
      links: Array<{ title: string; url: string }>,
      key: string,
    ) {
      const result = await transport.send(
        {
          from: transport.from,
          to: email,
          subject: "Your Ventra reservations",
          text: links.map((link) => `${link.title}: ${link.url}`).join("\n\n"),
          html: `<p>Your reservations:</p><ul>${links.map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a></li>`).join("")}</ul>`,
        },
        { idempotencyKey: key },
      );
      if (result.error) throw new Error("Email delivery failed");
    },
  };
}
export const accountEmailSender = createAccountEmailSender(resendTransport);
