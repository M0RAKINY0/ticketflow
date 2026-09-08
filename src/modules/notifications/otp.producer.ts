import type { OtpDeliveryJob } from "../../infrastructure/queues/contracts.js";
import { OTP_JOB_OPTIONS } from "../../infrastructure/queues/email-queues.js";
import { encryptOtpDelivery } from "./otp-envelope.js";

export type VerificationOtpProducer = {
  enqueue(email: string, otp: string): Promise<void>;
};

type AuthEmailQueue = {
  add(
    name: "send-verification-otp",
    data: OtpDeliveryJob,
    options: typeof OTP_JOB_OPTIONS,
  ): Promise<unknown>;
};

export function createOtpProducer(
  queue: AuthEmailQueue,
  secret: string,
  clock: () => Date = () => new Date(),
  idFactory: () => string = () => crypto.randomUUID(),
): VerificationOtpProducer {
  return {
    async enqueue(email, otp) {
      const payload = encryptOtpDelivery({ email, otp }, secret, clock());
      await queue.add("send-verification-otp", payload, {
        ...OTP_JOB_OPTIONS,
        jobId: `otp-${idFactory()}`,
      });
    },
  };
}
