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
  ticketId: string;
  publicId: string;
  recipientEmail: string;
  attendeeName: string;
  eventName: string;
  eventStartsAt: Date;
  eventTimezone: string;
  ticketTypeName: string;
  qrCodeDataUrl: string;
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
        subject: "Verify your Ventra email",
        text: `Your Ventra verification code is ${otp}. It expires in 5 minutes. Ignore this email if you did not create an account.`,
        html: `<p>Your Ventra verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes. Ignore this email if you did not create an account.</p>`,
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
      const qrContent = input.qrCodeDataUrl.replace(
        /^data:image\/png;base64,/,
        "",
      );
      const eventDate = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: input.eventTimezone,
      }).format(input.eventStartsAt);
      const attendeeName = escapeHtml(input.attendeeName);
      const eventName = escapeHtml(input.eventName);
      const ticketTypeName = escapeHtml(input.ticketTypeName);
      const publicId = escapeHtml(input.publicId);
      const result = await transport.send(
        {
          from: transport.from,
          to: input.recipientEmail,
          subject: `Your ticket for ${input.eventName}`,
          text: [
            `Hello ${input.attendeeName},`,
            `Your ${input.ticketTypeName} ticket for ${input.eventName} is ready.`,
            `Event date: ${eventDate}`,
            `Ticket reference: ${input.publicId}`,
            "Your QR code is attached to this email.",
          ].join("\n\n"),
          html: `<p>Hello ${attendeeName},</p><p>Your ${ticketTypeName} ticket for ${eventName} is ready.</p><p>Event date: ${eventDate}<br>Ticket reference: ${publicId}</p><p><img src="cid:ticket-qr" alt="Ticket QR code"></p>`,
          attachments: [
            {
              content: qrContent,
              filename: `ventra-ticket-${input.publicId}-inline.png`,
              contentId: "ticket-qr",
            },
            {
              content: qrContent,
              filename: `ventra-ticket-${input.publicId}.png`,
            },
          ],
        },
        { idempotencyKey: `ticket-confirmation/${input.ticketId}` },
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
