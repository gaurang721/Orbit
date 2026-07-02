import { z } from 'zod';

// ----- Reusable field schemas ------------------------------------------------

export const emailSchema = z.string().trim().toLowerCase().email('A valid email is required');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots and underscores are allowed');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[a-z]/, 'Include at least one lowercase letter')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number');

// ----- Register --------------------------------------------------------------

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  username: usernameSchema,
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ----- Login -----------------------------------------------------------------

export const loginSchema = z.object({
  // accept either email or username
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
  // present on the second leg of a 2FA login
  twoFactorCode: z.string().trim().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ----- Email verification ----------------------------------------------------

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

// ----- Password reset --------------------------------------------------------

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ----- Change password (authenticated) --------------------------------------

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ----- Two-factor authentication --------------------------------------------

export const twoFactorVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the 6-digit code')
    .or(z.string().trim().length(10, 'Enter a backup code')),
});
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

// ----- Response payloads -----------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  /** seconds until the access token expires */
  expiresIn: number;
}

/** Returned by login when the account requires a second factor. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  /** short-lived token proving the password step succeeded */
  challengeToken: string;
}

export interface Setup2FAResponse {
  /** otpauth:// URI to render as a QR code */
  otpauthUrl: string;
  secret: string;
}
