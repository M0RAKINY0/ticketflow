import { describe, it, expect, vi } from "vitest";
import { verifyTurnstile } from "../../src/infrastructure/turnstile.js";
const config = {
  secret: "secret",
  hostnames: ["ventra.example"],
  production: true,
};
describe("checkout bot verification", () => {
  it.each([
    { success: false },
    { success: true, hostname: "evil.example", action: "checkout" },
    { success: true, hostname: "ventra.example", action: "other" },
  ])("rejects invalid challenges %j", async (reply) => {
    await expect(
      verifyTurnstile(
        "token",
        config,
        vi.fn().mockResolvedValue({ ok: true, json: async () => reply }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it("accepts a token for the configured host and checkout action", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hostname: "ventra.example",
        action: "checkout",
      }),
    });
    await expect(
      verifyTurnstile("token", config, fetcher),
    ).resolves.toBeUndefined();
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      secret: "secret",
      response: "token",
    });
  });
  it("fails closed on upstream errors", async () => {
    await expect(
      verifyTurnstile(
        "token",
        config,
        vi.fn().mockRejectedValue(new Error("timeout")),
      ),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
  it("requires configuration in production", async () => {
    await expect(
      verifyTurnstile(undefined, { ...config, secret: undefined }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
  it("rejects missing or oversized tokens without contacting Cloudflare", async () => {
    const fetcher = vi.fn();
    for (const token of [undefined, "x".repeat(2049)])
      await expect(
        verifyTurnstile(token, config, fetcher),
      ).rejects.toMatchObject({ statusCode: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
