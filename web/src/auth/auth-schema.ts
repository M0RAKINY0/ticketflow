import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Use an international number, for example +234…'),
  password: z.string().min(12, 'Use at least 12 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
