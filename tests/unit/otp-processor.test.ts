import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { encryptOtpDelivery } from "../../src/modules/notifications/otp-envelope.js";
import { createOtpProcessor } from "../../src/modules/notifications/otp.processor.js";
import { createOtpProducer } from "../../src/modules/notifications/otp.producer.js";

const secret = "a".repeat(32);
const now = new Date("2030-01-01T00:00:00.000Z");

describe("OTP email jobs", () => {
  it("encrypts the OTP before adding it to the auth queue", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const producer = createOtpProducer(
      { add },
      secret,
      () => now,
      () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );

    await producer.enqueue("person@example.com", "123456");

    expect(add).toHaveBeenCalledOnce();
    const [name, data, options] = add.mock.calls[0]!;
    expect({ name, options }).toMatchObject({
      name: "send-verification-otp",
      options: {
        jobId: expect.stringMatching(/^otp-[0-9a-f-]{36}$/),
        attempts: 3,
      },
    });
    expect(JSON.stringify(data)).not.toContain("123456");
  });

  it("sends one valid OTP job", async () => {
    const sendVerificationOtp = vi.fn().mockResolvedValue(undefined);
    const processor = createOtpProcessor({
      secret,
      sender: { sendVerificationOtp },
      clock: () => now,
    });
    const data = encryptOtpDelivery(
      { email: "person@example.com", otp: "123456" },
      secret,
      now,
    );

    await processor({ name: "send-verification-otp", data } as never);

    expect(sendVerificationOtp).toHaveBeenCalledOnce();
  });

  it("never sends an expired OTP job", async () => {
    const sendVerificationOtp = vi.fn().mockResolvedValue(undefined);
    const processor = createOtpProcessor({
      secret,
      sender: { sendVerificationOtp },
      clock: () => new Date("2030-01-01T00:04:00.000Z"),
    });
    const data = encryptOtpDelivery(
      { email: "person@example.com", otp: "123456" },
      secret,
      now,
    );

    await expect(
      processor({ name: "send-verification-otp", data } as never),
    ).rejects.toThrow("OTP job expired");
    expect(sendVerificationOtp).not.toHaveBeenCalled();
  });

  it("never sends a malformed job", async () => {
    const sendVerificationOtp = vi.fn().mockResolvedValue(undefined);
    const processor = createOtpProcessor({
      secret,
      sender: { sendVerificationOtp },
      clock: () => now,
    });

    await expect(
      processor({ name: "send-verification-otp", data: {} } as never),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "UnrecoverableError",
        message: "OTP job payload is invalid",
      }),
    );
    expect(sendVerificationOtp).not.toHaveBeenCalled();
  });

  it("rejects an unknown job as a permanent failure", async () => {
    const sendVerificationOtp = vi.fn().mockResolvedValue(undefined);
    const processor = createOtpProcessor({
      secret,
      sender: { sendVerificationOtp },
      clock: () => now,
    });

    await expect(
      processor({ name: "unexpected", data: {} } as never),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(
      processor({ name: "unexpected", data: {} } as never),
    ).rejects.toThrow("Unsupported OTP job");
    expect(sendVerificationOtp).not.toHaveBeenCalled();
  });
});
