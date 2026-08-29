import { z } from "zod";

export const AUTH_EMAIL_QUEUE = "ventra-auth-email";
export const TICKET_EMAIL_QUEUE = "ventra-ticket-email";

const ticketEmailJobSchema = z.object({ ticketId: z.uuid() }).strict();
const otpDeliveryJobSchema = z
  .object({
    version: z.literal(1),
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
    tag: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type TicketEmailJob = z.infer<typeof ticketEmailJobSchema>;
export type OtpDeliveryJob = z.infer<typeof otpDeliveryJobSchema>;

export function parseTicketEmailJob(input: unknown): TicketEmailJob {
  return ticketEmailJobSchema.parse(input);
}

export function parseOtpDeliveryJob(input: unknown): OtpDeliveryJob {
  return otpDeliveryJobSchema.parse(input);
}
