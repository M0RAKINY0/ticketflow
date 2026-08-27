import { describe, expect, it } from "vitest";

import { createVerificationEmailSender } from "../../src/infrastructure/email.js";

describe("verification email", () => {
  it("sends the OTP without leaking provider details on failure", async () => {
    const messages: unknown[] = [];
    const sender = createVerificationEmailSender({
      from: "Ventra <auth@example.com>",
      send: async (message) => {
        messages.push(message);
        return { data: { id: "email-1" }, error: null };
      },
    });

    await sender.sendVerificationOtp("person@example.com", "123456");
    expect(messages[0]).toMatchObject({
      from: "Ventra <auth@example.com>",
      to: "person@example.com",
      subject: "Verify your Ventra email",
    });
    expect(JSON.stringify(messages[0])).toContain("123456");

    const failing = createVerificationEmailSender({
      from: "Ventra <auth@example.com>",
      send: async () => ({ data: null, error: { message: "provider detail" } }),
    });
    await expect(
      failing.sendVerificationOtp("secret@example.com", "654321"),
    ).rejects.toThrow("Email delivery failed");
  });
});
