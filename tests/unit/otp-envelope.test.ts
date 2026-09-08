import { describe, expect, it } from "vitest";

import {
  decryptOtpDelivery,
  encryptOtpDelivery,
} from "../../src/modules/notifications/otp-envelope.js";

const secret = "a".repeat(32);
const now = new Date("2030-01-01T00:00:00.000Z");

describe("OTP delivery envelopes", () => {
  it("encrypts and decrypts a short-lived OTP payload", () => {
    const encrypted = encryptOtpDelivery(
      { email: "person@example.com", otp: "123456" },
      secret,
      now,
    );

    expect(JSON.stringify(encrypted)).not.toContain("person@example.com");
    expect(JSON.stringify(encrypted)).not.toContain("123456");
    expect(
      decryptOtpDelivery(
        encrypted,
        secret,
        new Date("2030-01-01T00:03:59.999Z"),
      ),
    ).toEqual({ email: "person@example.com", otp: "123456" });
  });

  it("uses a fresh nonce for each payload", () => {
    const input = { email: "person@example.com", otp: "123456" };

    expect(encryptOtpDelivery(input, secret, now).iv).not.toBe(
      encryptOtpDelivery(input, secret, now).iv,
    );
  });

  it("rejects a tampered payload", () => {
    const encrypted = encryptOtpDelivery(
      { email: "person@example.com", otp: "123456" },
      secret,
      now,
    );
    const tampered = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext[0] === "a" ? "b" : "a"}${encrypted.ciphertext.slice(1)}`,
    };

    expect(() => decryptOtpDelivery(tampered, secret, now)).toThrow(
      "OTP job cannot be decrypted",
    );
  });

  it("rejects an OTP at its expiry time", () => {
    const encrypted = encryptOtpDelivery(
      { email: "person@example.com", otp: "123456" },
      secret,
      now,
    );

    expect(() =>
      decryptOtpDelivery(
        encrypted,
        secret,
        new Date("2030-01-01T00:04:00.000Z"),
      ),
    ).toThrow("OTP job expired");
  });
});
