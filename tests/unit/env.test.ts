import { describe, expect, it } from "vitest";

import { selectMigrationDatabaseUrl } from "../../src/config/database-url.js";
import { parseEnv } from "../../src/config/env.js";
import {
  POSTGRES_URL,
  SECRET_A,
  SECRET_B,
  TEST_POSTGRES_URL,
} from "../setup/env.js";

function validEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    PORT: "4000",
    DATABASE_URL: POSTGRES_URL,
    TEST_DATABASE_URL: TEST_POSTGRES_URL,
    ACCESS_TOKEN_SECRET: SECRET_A,
    REFRESH_TOKEN_SECRET: SECRET_B,
    ...overrides,
  };
}

describe("parseEnv", () => {
  it("rejects an integration database equal to the application database", () => {
    expect(() =>
      parseEnv(validEnvironment({ TEST_DATABASE_URL: POSTGRES_URL })),
    ).toThrow(/TEST_DATABASE_URL must differ/);
  });

  it("requires TEST_DATABASE_URL in test mode", () => {
    expect(() =>
      parseEnv(validEnvironment({ TEST_DATABASE_URL: undefined })),
    ).toThrow(/TEST_DATABASE_URL is required/);
  });

  it("selects TEST_DATABASE_URL as the test database", () => {
    expect(parseEnv(validEnvironment()).DATABASE_URL).toBe(TEST_POSTGRES_URL);
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(() =>
      parseEnv(validEnvironment({ ACCESS_TOKEN_SECRET: "a".repeat(31) })),
    ).toThrow(/32/);
  });

  it("applies development and port defaults", () => {
    const environment = validEnvironment({
      NODE_ENV: undefined,
      PORT: undefined,
      TEST_DATABASE_URL: undefined,
    });

    expect(parseEnv(environment)).toMatchObject({
      NODE_ENV: "development",
      PORT: 4000,
      DATABASE_URL: POSTGRES_URL,
    });
  });

  it("parses a valid production environment", () => {
    expect(
      parseEnv(
        validEnvironment({
          NODE_ENV: "production",
          TEST_DATABASE_URL: undefined,
          FRONTEND_ORIGINS: "https://ventra.example",
        }),
      ),
    ).toMatchObject({
      NODE_ENV: "production",
      DATABASE_URL: POSTGRES_URL,
      FRONTEND_ORIGINS: ["https://ventra.example"],
    });
  });

  it("requires explicit production origins", () => {
    expect(() =>
      parseEnv(
        validEnvironment({
          NODE_ENV: "production",
          TEST_DATABASE_URL: undefined,
        }),
      ),
    ).toThrow(/FRONTEND_ORIGINS must be set/);
  });

  it("rejects wildcard browser origins", () => {
    expect(() => parseEnv(validEnvironment({ FRONTEND_ORIGINS: "*" }))).toThrow(
      /explicit HTTP\(S\) origins/,
    );
  });
});

describe("selectMigrationDatabaseUrl", () => {
  it("selects TEST_DATABASE_URL for a test migration", () => {
    expect(selectMigrationDatabaseUrl(validEnvironment())).toBe(
      TEST_POSTGRES_URL,
    );
  });

  it("rejects a missing test migration database URL", () => {
    expect(() =>
      selectMigrationDatabaseUrl(
        validEnvironment({ TEST_DATABASE_URL: undefined }),
      ),
    ).toThrow(/TEST_DATABASE_URL is required/);
  });

  it("rejects an application database as a test migration target", () => {
    expect(() =>
      selectMigrationDatabaseUrl(
        validEnvironment({ TEST_DATABASE_URL: POSTGRES_URL }),
      ),
    ).toThrow(/TEST_DATABASE_URL must differ/);
  });
});
