import { z } from 'zod';

// Schemas specific to the API surface that aren't part of the shared client DTOs.

export const loginTwoFactorSchema = z.object({
  challengeToken: z.string().min(1, 'Challenge token is required'),
  code: z.string().trim().min(6, 'Enter your 6-digit or backup code'),
});

export const enable2FASchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export const sessionIdParamSchema = z.object({
  id: z.string().min(1),
});
