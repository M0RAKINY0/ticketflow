import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, jwt, openAPI } from "better-auth/plugins";
import type { SecondaryStorage } from "better-auth";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { limitVerificationEmail, redisAuthStorage } from "./redis.js";
import { type VerificationOtpProducer } from "../modules/notifications/otp.producer.js";
import { createApiOtpRuntime } from "./queues/api-otp-runtime.js";

import type { NotificationProducer } from "../modules/notifications/account-email.js";

const apiOtpRuntime =
  env.NODE_ENV === "test" ? undefined : createApiOtpRuntime();

export function createAuth(
  options: {
    notificationProducer?: NotificationProducer;
    rateLimitEnabled?: boolean;
    otpProducer?: VerificationOtpProducer;
    secondaryStorage?: SecondaryStorage;
    requireEmailVerification?: boolean;
    limitVerificationEmail?: (email: string) => Promise<void>;
  } = {},
) {
  const requireEmailVerification =
    options.requireEmailVerification ?? env.NODE_ENV !== "test";
  const otpProducer = options.otpProducer ??
    apiOtpRuntime?.otpProducer ?? { enqueue: async () => undefined };
  const emailLimiter =
    options.limitVerificationEmail ??
    (env.NODE_ENV === "test" ? async () => undefined : limitVerificationEmail);
  return betterAuth({
    appName: "Ventra",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.FRONTEND_ORIGINS,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const producer =
          options.notificationProducer ?? apiOtpRuntime?.notificationProducer;
        if (!producer)
          throw new Error("Password reset delivery is not configured");
        await producer.enqueue({
          kind: "password-reset",
          email: user.email,
          url,
        });
      },
    },
    emailVerification: {
      // Runs once a code has proved the user owns `user.email`: at signup
      // verification, and with the old address when they change email.
      // Guest orders bought with that address move into the account, so
      // they stay there after the email changes.
      async beforeEmailVerification(user) {
        await claimGuestReservations(user.id, user.email);
      },
    },
    secondaryStorage:
      options.secondaryStorage ??
      (env.NODE_ENV === "test" ? undefined : redisAuthStorage),
    verification: { storeIdentifier: "hashed" },
    rateLimit: {
      enabled: options.rateLimitEnabled ?? env.NODE_ENV !== "test",
      window: 60,
      max: 100,
      customRules: {
        "/request-password-reset": { window: 15 * 60, max: 3 },
        "/reset-password": { window: 15 * 60, max: 5 },
        "/sign-in/email": { window: 15 * 60, max: 5 },
        "/sign-up/email": { window: 60 * 60, max: 5 },
        "/sign-in/social": { window: 60, max: 20 },
        "/get-session": { window: 60, max: 60 },
        "/token": { window: 60, max: 60 },
        "/sign-out": { window: 60, max: 20 },
        "/email-otp/send-verification-otp": { window: 15 * 60, max: 3 },
        "/email-otp/verify-email": { window: 15 * 60, max: 5 },
        "/email-otp/request-email-change": { window: 15 * 60, max: 3 },
        "/email-otp/change-email": { window: 15 * 60, max: 5 },
        "/change-password": { window: 15 * 60, max: 5 },
        "/list-sessions": { window: 60, max: 60 },
        "/revoke-session": { window: 60, max: 20 },
        "/revoke-sessions": { window: 60, max: 20 },
        "/revoke-other-sessions": { window: 60, max: 20 },
        "/list-accounts": { window: 60, max: 60 },
        "/link-social": { window: 60, max: 10 },
        "/unlink-account": { window: 60, max: 10 },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: `${env.BETTER_AUTH_URL}/api/v1/auth/callback/google`,
      },
    },
    user: {
      additionalFields: {
        phoneNumber: {
          type: "string",
          required: false,
        },
        role: {
          type: ["USER", "ADMIN"],
          required: false,
          defaultValue: "USER",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      storeSessionInDatabase: true,
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      database: {
        generateId: "uuid",
        joins: true,
      },
    },
    plugins: [
      openAPI({ disableDefaultReference: true }),
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: requireEmailVerification,
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        // Changing email takes a code from the current address, then one
        // from the new address, so a stolen session alone can't move the
        // account to an attacker's inbox.
        changeEmail: { enabled: true, verifyCurrentEmail: true },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification" && type !== "change-email") {
            throw new Error("Unsupported OTP type");
          }
          await emailLimiter(email);
          await otpProducer.enqueue(email, otp);
        },
      }),
      jwt({
        jwt: {
          issuer: env.BETTER_AUTH_URL,
          audience: env.BETTER_AUTH_URL,
          expirationTime: "15m",
          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            role: user.role,
          }),
        },
      }),
    ],
  });
}

/** Moves unowned guest orders bought with `email` into the account. */
async function claimGuestReservations(userId: string, email: string) {
  await prisma.reservation.updateMany({
    where: { userId: null, buyerEmail: email.toLowerCase() },
    data: { userId },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth();

export async function closeAuthOtpProducer(): Promise<void> {
  await apiOtpRuntime?.close();
}

export async function enqueueAccountEmail(
  input: import("../modules/notifications/account-email.js").AccountEmail,
): Promise<void> {
  if (!apiOtpRuntime) throw new Error("Account email queue is not configured");
  await apiOtpRuntime.notificationProducer.enqueue(input);
}
