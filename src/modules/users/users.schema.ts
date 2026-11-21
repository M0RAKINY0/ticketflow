import { z } from "zod";

export const userIdSchema = z.object({ userId: z.uuid() });

export const roleSchema = z.object({ role: z.enum(["USER", "ADMIN"]) });

export const userListQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(256).optional(),
});

export const addPasswordSchema = z.object({
  newPassword: z.string().min(1).max(256),
});

const handle = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .pipe(z.string().regex(pattern, message))
    .nullable()
    .optional();

/** Replaces the whole organizer profile. Fields left out are cleared. */
export const organizerProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(1_000).nullable().optional(),
  logoUrl: z
    .url()
    .max(2_000)
    .refine(
      (value) => new URL(value).protocol === "https:",
      "Logo URL must use HTTPS",
    )
    .nullable()
    .optional(),
  instagramHandle: handle(
    /^[A-Za-z0-9._]{1,30}$/,
    "Use up to 30 letters, numbers, dots or underscores",
  ),
  xHandle: handle(
    /^[A-Za-z0-9_]{1,15}$/,
    "Use up to 15 letters, numbers or underscores",
  ),
  supportEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email())
    .nullable()
    .optional(),
  supportPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a phone number")
    .nullable()
    .optional(),
});

export type OrganizerProfileInput = z.infer<typeof organizerProfileSchema>;
