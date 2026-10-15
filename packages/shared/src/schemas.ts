import { z } from 'zod';

import { ROLES } from './roles.ts';

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

// Fields are listed in the order the form shows them, so the first error matches the top field.
export const signUpSchema = z.object({
  role: z.enum(ROLES),
  fullName: z.string().trim().min(1, 'Enter your name'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
