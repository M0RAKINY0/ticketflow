import { describe, expect, it } from "vitest";

import { canManageEvent } from "../../src/modules/ticketing/ticketing.authorization.js";

describe("event ownership authorization", () => {
  it("lets the event owner manage an event regardless of account role", () => {
    expect(canManageEvent({ id: "user-1", role: "USER" }, "user-1")).toBe(true);
  });

  it("lets admins manage every event", () => {
    expect(canManageEvent({ id: "admin-1", role: "ADMIN" }, "user-1")).toBe(
      true,
    );
  });

  it("denies another regular user", () => {
    expect(canManageEvent({ id: "user-2", role: "USER" }, "user-1")).toBe(
      false,
    );
  });
});
