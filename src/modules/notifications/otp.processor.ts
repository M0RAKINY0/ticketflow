import { UnrecoverableError, type Job } from "bullmq";

import type { VerificationEmailSender } from "../../infrastructure/email.js";
import { parseOtpDeliveryJob } from "../../infrastructure/queues/contracts.js";
import { decryptOtpDelivery } from "./otp-envelope.js";

export function createOtpProcessor({
  secret,
  sender,
  clock = () => new Date(),
}: {
  secret: string;
  sender: VerificationEmailSender;
  clock?: () => Date;
}): (job: Job) => Promise<void> {
  return async (job) => {
    if (job.name !== "send-verification-otp") {
      throw new UnrecoverableError("Unsupported OTP job");
    }

    let payload;
    try {
      payload = parseOtpDeliveryJob(job.data);
    } catch {
      throw new UnrecoverableError("OTP job payload is invalid");
    }
    const { email, otp } = decryptOtpDelivery(payload, secret, clock());
    await sender.sendVerificationOtp(email, otp);
  };
}
