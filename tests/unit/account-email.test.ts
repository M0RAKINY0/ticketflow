import { describe, it, expect, vi } from "vitest";
import {
  createNotificationProducer,
  createNotificationProcessor,
} from "../../src/modules/notifications/account-email.js";
const secret = "s".repeat(32);
describe("account email queue", () => {
  it("encrypts reset links before queueing and delivers the decrypted URL", async () => {
    const queue = { add: vi.fn() };
    const sender = { sendPasswordReset: vi.fn() };
    await createNotificationProducer(queue, secret).enqueue({
      kind: "password-reset",
      email: "buyer@example.com",
      url: "https://api.example/reset/secret-token",
    });
    const [name, data] = queue.add.mock.calls[0];
    expect(JSON.stringify(data)).not.toContain("secret-token");
    expect(JSON.stringify(data)).not.toContain("buyer@example.com");
    await createNotificationProcessor({ secret, sender } as never)({
      name,
      data,
    } as never);
    expect(sender.sendPasswordReset).toHaveBeenCalledWith(
      "buyer@example.com",
      "https://api.example/reset/secret-token",
      expect.any(String),
    );
  });
});
