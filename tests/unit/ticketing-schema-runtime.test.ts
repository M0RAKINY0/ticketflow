import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { createEventSchema } from "../../src/modules/ticketing/ticketing.schema.js";

describe("ticketing schema runtime dependencies", () => {
  it("validates ISO country codes when loaded through Node ESM", () => {
    const baseEvent = {
      title: "Runtime validation smoke test",
      description: "Checks the country-code dependency at runtime.",
      startsAt: "2030-01-01T10:00:00.000Z",
      endsAt: "2030-01-01T11:00:00.000Z",
      venue: "Civic Centre",
      category: "COMMUNITY",
      city: "Lagos",
      currency: "NGN",
      timezone: "Africa/Lagos",
    } as const;

    expect(
      createEventSchema.safeParse({ ...baseEvent, countryCode: "NG" }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({ ...baseEvent, countryCode: "ZZ" }).success,
    ).toBe(false);
  });

  it("can be imported by the native Node ESM loader", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--input-type=module",
          "-e",
          "await import('./src/modules/ticketing/ticketing.schema.ts')",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      ),
    ).not.toThrow();
  });
});
