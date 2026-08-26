import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins";

import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

export const auth = betterAuth({
  appName: "Ventra",
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.FRONTEND_ORIGINS,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
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
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    database: {
      generateId: "uuid",
      joins: true,
    },
  },
  plugins: [
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
