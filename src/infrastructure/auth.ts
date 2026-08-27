import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP, jwt } from "better-auth/plugins";
import type { SecondaryStorage } from "better-auth";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { limitVerificationEmail, redisAuthStorage } from "./redis.js";
import {
  verificationEmailSender,
  type VerificationEmailSender,
} from "./email.js";

export function createAuth(
  options: {
    rateLimitEnabled?: boolean;
    emailSender?: VerificationEmailSender;
    secondaryStorage?: SecondaryStorage;
    requireEmailVerification?: boolean;
    limitVerificationEmail?: (email: string) => Promise<void>;
  } = {},
) {
  const requireEmailVerification =
    options.requireEmailVerification ?? env.NODE_ENV !== "test";
  const emailSender =
    options.emailSender ??
    (env.NODE_ENV === "test"
      ? { sendVerificationOtp: async () => undefined }
      : verificationEmailSender);
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
    emailAndPassword: { enabled: true, requireEmailVerification },
    secondaryStorage:
      options.secondaryStorage ??
      (env.NODE_ENV === "test" ? undefined : redisAuthStorage),
    verification: { storeIdentifier: "hashed" },
    rateLimit: {
      enabled: options.rateLimitEnabled ?? env.NODE_ENV !== "test",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
        "/sign-up/email": { window: 60 * 60, max: 5 },
        "/sign-in/social": { window: 60, max: 20 },
        "/get-session": { window: 60, max: 60 },
        "/token": { window: 60, max: 60 },
        "/sign-out": { window: 60, max: 20 },
        "/email-otp/send-verification-otp": { window: 15 * 60, max: 3 },
        "/email-otp/verify-email": { window: 15 * 60, max: 5 },
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
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: requireEmailVerification,
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification") {
            throw new Error("Unsupported OTP type");
          }
          await emailLimiter(email);
          await emailSender.sendVerificationOtp(email, otp);
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

export type Auth = ReturnType<typeof createAuth>;

export const auth = createAuth();
