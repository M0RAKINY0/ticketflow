import { describe, expect, it, vi } from "vitest";

import { createApiOtpRuntime } from "../../src/infrastructure/queues/api-otp-runtime.js";

describe("API OTP runtime", () => {
  it("owns the producer queue and closes it after use", async () => {
    const connection = {} as never;
    const add = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createConnection = vi.fn(() => connection);
    const createQueues = vi.fn(() => ({ authEmailQueue: { add }, close }));
    const runtime = createApiOtpRuntime({
      url: "redis://localhost:6379",
      secret: "a".repeat(32),
      createConnection,
      createQueues,
    });

    await runtime.otpProducer.enqueue("person@example.com", "123456");
    await runtime.close();

    expect(createConnection).toHaveBeenCalledWith("redis://localhost:6379");
    expect(add).toHaveBeenCalledOnce();
    expect(JSON.stringify(add.mock.calls[0]?.[1])).not.toContain(
      "person@example.com",
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
