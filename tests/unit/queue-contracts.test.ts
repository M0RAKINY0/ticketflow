import { describe, expect, it } from "vitest";

import {
  parseOtpDeliveryJob,
  parseTicketEmailJob,
} from "../../src/infrastructure/queues/contracts.js";
import {
  OTP_JOB_OPTIONS,
  TICKET_JOB_OPTIONS,
} from "../../src/infrastructure/queues/email-queues.js";

const ticketUuid = "c0a8012e-2e4f-4ba6-b0e9-fdfde5ff2e2c";

describe("email queue contracts", () => {
  it("accepts a ticket email job with a UUID ticket ID", () => {
    expect(parseTicketEmailJob({ ticketId: ticketUuid })).toEqual({
      ticketId: ticketUuid,
    });
  });

  it("rejects a ticket email job without a UUID ticket ID", () => {
    expect(() => parseTicketEmailJob({ ticketId: "not-a-uuid" })).toThrow();
  });

  it("rejects an invalid OTP delivery envelope", () => {
    expect(() =>
      parseOtpDeliveryJob({
        version: 1,
        ciphertext: "",
        iv: "",
        tag: "",
        expiresAt: "invalid",
      }),
    ).toThrow();
  });
});

describe("email queue job options", () => {
  it("retries OTP email jobs with a short fixed delay and removes them", () => {
    expect(OTP_JOB_OPTIONS).toMatchObject({
      attempts: 3,
      backoff: { type: "fixed", delay: 1_000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  });

  it("retains ticket email job history while retrying with exponential backoff", () => {
    expect(TICKET_JOB_OPTIONS).toMatchObject({
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 604_800, count: 5_000 },
    });
  });
});
