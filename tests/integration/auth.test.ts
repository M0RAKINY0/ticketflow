import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, generateKeyPair, SignJWT } from "jose";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins";

import { createApp } from "../../src/app.js";
import { auth } from "../../src/infrastructure/auth.js";
import { prisma } from "../../src/infrastructure/prisma.js";

const AUTH_TEST_EMAIL_PREFIX = "auth-test-";
const password = "Correct-Horse-42";

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { startsWith: AUTH_TEST_EMAIL_PREFIX } },
  });
});

async function signUp(email: string, body: Record<string, unknown> = {}) {
  return request(createApp())
    .post("/api/v1/auth/sign-up/email")
    .send({ email, name: "Guest User", password, ...body });
}

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) throw new Error("Expected a Better Auth session cookie");
  return value.split(";", 1)[0]!;
}

describe("Better Auth", () => {
  it("creates a USER with optional phone number and stores the password only in Account", async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}signup@example.com`;
    const response = await signUp(email);
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { accounts: true },
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ email, role: "USER" });
    expect(response.body.user.phoneNumber).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain("password");
    expect(storedUser.accounts).toHaveLength(1);
    expect(storedUser.accounts[0]?.providerId).toBe("credential");
    expect(storedUser.accounts[0]?.password).toBeTruthy();
  });

  it("ignores a role supplied by a public registrant", async () => {
    const response = await signUp(`${AUTH_TEST_EMAIL_PREFIX}role@example.com`, {
      role: "ADMIN",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("USER");
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { email: `${AUTH_TEST_EMAIL_PREFIX}role@example.com` },
      }),
    ).toMatchObject({ role: "USER" });
  });

  it("signs in with email and creates a secure session", async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}signin@example.com`;
    await signUp(email);

    const response = await request(createApp())
      .post("/api/v1/auth/sign-in/email")
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(email);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Lax");
  });

  it("returns a session and signs it out", async () => {
    const registration = await signUp(
      `${AUTH_TEST_EMAIL_PREFIX}session@example.com`,
    );
    const cookie = sessionCookie(registration);

    const active = await request(createApp())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie);
    const signedOut = await request(createApp())
      .post("/api/v1/auth/sign-out")
      .set("Cookie", cookie);
    const ended = await request(createApp())
      .get("/api/v1/auth/get-session")
      .set("Cookie", cookie);

    expect(active.status).toBe(200);
    expect(active.body.user.email).toBe(
      `${AUTH_TEST_EMAIL_PREFIX}session@example.com`,
    );
    expect(signedOut.status).toBe(200);
    expect(ended.body).toBeNull();
  });

  it("rejects invalid credentials and duplicate email signup", async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}duplicate@example.com`;
    await signUp(email);

    const invalid = await request(createApp())
      .post("/api/v1/auth/sign-in/email")
      .send({ email, password: "wrong-password" });
    const duplicate = await signUp(email);

    expect(invalid.status).toBe(401);
    expect(duplicate.status).toBe(422);
  });

  it("builds a Google authorization URL with the configured callback", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/sign-in/social")
      .send({ provider: "google", callbackURL: "http://localhost:5173" });

    expect(response.status).toBe(200);
    expect(response.body.url).toContain("accounts.google.com");
    expect(decodeURIComponent(response.body.url)).toContain(
      "http://localhost:4001/api/v1/auth/callback/google",
    );
  });

  it("issues a 15-minute JWT for an authenticated session", async () => {
    const registration = await signUp(
      `${AUTH_TEST_EMAIL_PREFIX}jwt@example.com`,
    );
    const cookie = sessionCookie(registration);

    const response = await request(createApp())
      .get("/api/v1/auth/token")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.token.split(".")).toHaveLength(3);
    const claims = decodeJwt(response.body.token);
    expect(claims.exp! - claims.iat!).toBe(15 * 60);
    expect(claims.role).toBe("USER");
  });

  it("authorizes protected routes with either a session cookie or JWT", async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}protected@example.com`;
    const registration = await signUp(email);
    const cookie = sessionCookie(registration);
    const tokenResponse = await request(createApp())
      .get("/api/v1/auth/token")
      .set("Cookie", cookie);

    const sessionRequest = await request(createApp())
      .get("/api/v1/me")
      .set("Cookie", cookie);
    const jwtRequest = await request(createApp())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${tokenResponse.body.token}`);
    const invalid = await request(createApp())
      .get("/api/v1/me")
      .set("Authorization", "Bearer invalid-token");

    expect(sessionRequest.status).toBe(200);
    expect(sessionRequest.body.data.user.email).toBe(email);
    expect(jwtRequest.status).toBe(200);
    expect(jwtRequest.body.data.user.email).toBe(email);
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required",
      },
    });
  });

  it("rejects an expired JWT", async () => {
    const registration = await signUp(
      `${AUTH_TEST_EMAIL_PREFIX}expired-jwt@example.com`,
    );
    const cookie = sessionCookie(registration);
    const tokenResponse = await request(createApp())
      .get("/api/v1/auth/token")
      .set("Cookie", cookie);
    const claims = decodeJwt(tokenResponse.body.token);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime((claims.exp! + 1) * 1_000);

    try {
      const response = await request(createApp())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${tokenResponse.body.token}`);
      expect(response.status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects wrongly issued and wrongly signed JWTs", async () => {
    const registration = await signUp(
      `${AUTH_TEST_EMAIL_PREFIX}invalid-jwt@example.com`,
    );
    const userId = registration.body.user.id as string;
    const wrongIssuerAuth = betterAuth({
      baseURL: "https://wrong-issuer.example",
      secret: process.env.BETTER_AUTH_SECRET,
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      advanced: { database: { generateId: "uuid" } },
      plugins: [
        jwt({
          jwt: {
            issuer: "https://wrong-issuer.example",
            audience: "http://localhost:4001",
          },
        }),
      ],
    });
    const wrongIssuer = await wrongIssuerAuth.api.signJWT({
      body: {
        payload: { sub: userId, role: "USER" },
      },
    });
    const removedRole = await auth.api.signJWT({
      body: { payload: { sub: userId, role: "ORGANIZER" } },
    });
    const { privateKey } = await generateKeyPair("EdDSA");
    const wrongSignature = await new SignJWT({ role: "USER" })
      .setProtectedHeader({ alg: "EdDSA" })
      .setSubject(userId)
      .setIssuer("http://localhost:4001")
      .setAudience("http://localhost:4001")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(privateKey);

    for (const [name, token] of [
      ["wrong issuer", wrongIssuer.token],
      ["wrong signature", wrongSignature],
      ["removed role", removedRole.token],
    ] as const) {
      const response = await request(createApp())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status, name).toBe(401);
    }
  });
});
