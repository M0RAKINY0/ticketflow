import { createHmac } from "node:crypto";
import type { Job, JobsOptions } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { z } from "zod";
import { encryptEmailDelivery, decryptEmailDelivery } from "./otp-envelope.js";
import {
  parseOtpDeliveryJob,
  type OtpDeliveryJob,
} from "../../infrastructure/queues/contracts.js";
import { OTP_JOB_OPTIONS } from "../../infrastructure/queues/email-queues.js";
import { prisma } from "../../infrastructure/prisma.js";
import {
  createReservationUrl,
  RESERVATION_LINK_GRACE_MS,
} from "../../utilities/reservation-access.js";
const email = z.email();
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("password-reset"), email, url: z.url() }),
  z.object({ kind: z.literal("ticket-recovery"), email }),
]);
export type AccountEmail = z.infer<typeof schema>;
export type NotificationProducer = {
  enqueue(input: AccountEmail): Promise<void>;
};
export function createNotificationProducer(
  queue: {
    add(
      name: string,
      data: OtpDeliveryJob,
      options: JobsOptions,
    ): Promise<unknown>;
  },
  secret: string,
): NotificationProducer {
  return {
    async enqueue(input) {
      await queue.add(
        "send-account-email",
        encryptEmailDelivery(
          schema.parse(input),
          secret,
          new Date(),
          14 * 60 * 1000,
        ),
        {
          ...OTP_JOB_OPTIONS,
          attempts: 5,
          jobId: `account-${crypto.randomUUID()}`,
        },
      );
    },
  };
}
export type AccountEmailSender = {
  sendPasswordReset(email: string, url: string, key: string): Promise<void>;
  sendRecovery(
    email: string,
    links: Array<{ title: string; url: string }>,
    key: string,
  ): Promise<void>;
};
export function createNotificationProcessor({
  secret,
  sender,
}: {
  secret: string;
  sender: AccountEmailSender;
}) {
  return async (job: Job) => {
    if (job.name !== "send-account-email")
      throw new UnrecoverableError("Unsupported account email job");
    let input: AccountEmail;
    try {
      input = schema.parse(
        decryptEmailDelivery(parseOtpDeliveryJob(job.data), secret, new Date()),
      );
    } catch {
      throw new UnrecoverableError("Invalid or expired account email job");
    }
    const key = createHmac("sha256", secret)
      .update(job.id ?? JSON.stringify(job.data))
      .digest("hex");
    if (input.kind === "password-reset") {
      await sender.sendPasswordReset(
        input.email,
        input.url,
        `password-reset/${key}`,
      );
      return;
    }
    let cursor: string | undefined;
    let page = 0;
    while (true) {
      const reservations = await prisma.reservation.findMany({
        // Skip events whose links have already expired.
        where: {
          buyerEmail: input.email,
          event: {
            endsAt: {
              gte: new Date(Date.now() - RESERVATION_LINK_GRACE_MS),
            },
          },
        },
        orderBy: { id: "asc" },
        take: 50,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          accessVersion: true,
          event: { select: { title: true } },
        },
      });
      if (!reservations.length) break;
      await sender.sendRecovery(
        input.email,
        reservations.map((r) => ({
          title: r.event.title,
          url: createReservationUrl(r),
        })),
        `ticket-recovery/${key}/${page++}`,
      );
      if (reservations.length < 50) break;
      cursor = reservations.at(-1)!.id;
    }
  };
}
