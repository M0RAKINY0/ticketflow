import { Resend } from "resend";

import { env } from "../config/env.js";

type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

type EmailTransport = {
  from: string;
  send(message: EmailMessage): Promise<{ data: unknown; error: unknown }>;
};

export type VerificationEmailSender = {
  sendVerificationOtp(email: string, otp: string): Promise<void>;
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

const resend = new Resend(env.RESEND_API_KEY);
export const verificationEmailSender = createVerificationEmailSender({
  from: env.AUTH_EMAIL_FROM,
  send: (message) => resend.emails.send(message),
});
