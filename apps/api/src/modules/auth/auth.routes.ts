import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  twoFactorDisableSchema,
  verifyEmailSchema,
} from '@fbclone/types';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rate-limit.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { authController } from './auth.controller.js';
import { enable2FASchema, loginTwoFactorSchema, sessionIdParamSchema } from './auth.validation.js';

const router: Router = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Registration, login, sessions, password and 2FA management
 */

// ---- Public ----------------------------------------------------------------

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201: { description: Account created; sets refreshToken cookie }
 *       409: { description: Email or username already in use }
 *       422: { description: Validation error }
 */
router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(authController.register));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email/username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200: { description: Logged in, or a twoFactorRequired challenge }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));

/**
 * @openapi
 * /auth/login/2fa:
 *   post:
 *     tags: [Auth]
 *     summary: Complete a two-factor login challenge
 *     responses:
 *       200: { description: Logged in }
 *       401: { description: Invalid or expired code }
 */
router.post('/login/2fa', authRateLimiter, validate(loginTwoFactorSchema), asyncHandler(authController.loginTwoFactor));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and issue a new access token
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Missing/invalid refresh token }
 */
router.post('/refresh', asyncHandler(authController.refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current session
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', asyncHandler(authController.logout));

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verify an email address with a token
 *     responses:
 *       200: { description: Email verified }
 *       400: { description: Invalid or expired token }
 */
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));

router.post(
  '/resend-verification',
  authRateLimiter,
  validate(resendVerificationSchema),
  asyncHandler(authController.resendVerification),
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password-reset email
 *     responses:
 *       200: { description: Always succeeds (does not reveal account existence) }
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset a password using a reset token
 *     responses:
 *       200: { description: Password updated }
 *       400: { description: Invalid or expired token }
 */
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

// ---- Authenticated ---------------------------------------------------------

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
router.get('/me', requireAuth, asyncHandler(authController.me));

router.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));

router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

// 2FA management
router.post('/2fa/setup', requireAuth, asyncHandler(authController.setup2FA));
router.post('/2fa/enable', requireAuth, validate(enable2FASchema), asyncHandler(authController.enable2FA));
router.post(
  '/2fa/disable',
  requireAuth,
  validate(twoFactorDisableSchema),
  asyncHandler(authController.disable2FA),
);

// Session management
router.get('/sessions', requireAuth, asyncHandler(authController.listSessions));
router.delete(
  '/sessions/:id',
  requireAuth,
  validate(sessionIdParamSchema, 'params'),
  asyncHandler(authController.revokeSession),
);

export const authRouter = router;
