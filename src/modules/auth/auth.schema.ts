import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().min(7).max(30),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});
