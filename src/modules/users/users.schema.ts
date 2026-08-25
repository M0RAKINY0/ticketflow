import { z } from "zod";

export const userIdSchema = z.object({ userId: z.uuid() });

export const roleSchema = z.object({ role: z.enum(["USER", "ADMIN"]) });

export const userListQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
