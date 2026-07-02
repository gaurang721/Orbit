import type { Request, Response } from 'express';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TwoFactorDisableInput,
  VerifyEmailInput,
} from '@fbclone/types';
import { errors } from '../../utils/http-error.js';
import { sendSuccess } from '../../utils/response.js';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from '../../utils/cookies.js';
import { otpAuthUrlToDataUrl } from '../../utils/totp.js';
import { authService } from './auth.service.js';
import { isTwoFactorChallenge } from './auth.types.js';

function contextFrom(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
    deviceName: req.header('x-device-name') ?? undefined,
  };
}

function readRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE_NAME];
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput, contextFrom(req));
    setRefreshCookie(res, result.refreshToken, result.rememberMe);
    sendSuccess(
      res,
      { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn },
      201,
      'Account created. Check your email to verify your address.',
    );
  },

  async login(req: Request, res: Response): Promise<void> {
    const outcome = await authService.login(req.body as LoginInput, contextFrom(req));
    if (isTwoFactorChallenge(outcome)) {
      sendSuccess(res, outcome, 200, 'Two-factor authentication required');
      return;
    }
    setRefreshCookie(res, outcome.refreshToken, outcome.rememberMe);
    sendSuccess(res, {
      user: outcome.user,
      accessToken: outcome.accessToken,
      expiresIn: outcome.expiresIn,
    });
  },

  async loginTwoFactor(req: Request, res: Response): Promise<void> {
    const { challengeToken, code } = req.body as { challengeToken: string; code: string };
    const result = await authService.loginTwoFactor(challengeToken, code, contextFrom(req));
    setRefreshCookie(res, result.refreshToken, result.rememberMe);
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const result = await authService.refresh(readRefreshCookie(req), contextFrom(req));
    setRefreshCookie(res, result.refreshToken, result.rememberMe);
    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    sendSuccess(res, { ok: true }, 200, 'Logged out');
  },

  async logoutAll(req: Request, res: Response): Promise<void> {
    await authService.logoutAll(req.user!.id);
    clearRefreshCookie(res);
    sendSuccess(res, { ok: true }, 200, 'Logged out of all sessions');
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getCurrentUser(req.user!.id);
    sendSuccess(res, { user });
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.body as VerifyEmailInput;
    const user = await authService.verifyEmail(token);
    sendSuccess(res, { user }, 200, 'Email verified');
  },

  async resendVerification(req: Request, res: Response): Promise<void> {
    await authService.resendVerification((req.body as { email: string }).email);
    sendSuccess(res, { ok: true }, 200, 'If the account exists, a verification email has been sent.');
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.forgotPassword((req.body as ForgotPasswordInput).email);
    sendSuccess(res, { ok: true }, 200, 'If the account exists, a reset link has been sent.');
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as ResetPasswordInput;
    await authService.resetPassword(token, password);
    sendSuccess(res, { ok: true }, 200, 'Password updated. Please log in again.');
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    await authService.changePassword(
      req.user!.id,
      req.body as ChangePasswordInput,
      req.user!.sessionId,
    );
    sendSuccess(res, { ok: true }, 200, 'Password changed');
  },

  // ----- 2FA -----------------------------------------------------------------
  async setup2FA(req: Request, res: Response): Promise<void> {
    const setup = await authService.setup2FA(req.user!.id);
    const qrDataUrl = await otpAuthUrlToDataUrl(setup.otpauthUrl);
    sendSuccess(res, { ...setup, qrDataUrl });
  },

  async enable2FA(req: Request, res: Response): Promise<void> {
    const { code } = req.body as { code: string };
    if (!code) throw errors.badRequest('Verification code is required');
    const backupCodes = await authService.enable2FA(req.user!.id, code);
    sendSuccess(res, { backupCodes }, 200, 'Two-factor authentication enabled');
  },

  async disable2FA(req: Request, res: Response): Promise<void> {
    const { password } = req.body as TwoFactorDisableInput;
    await authService.disable2FA(req.user!.id, password);
    sendSuccess(res, { ok: true }, 200, 'Two-factor authentication disabled');
  },

  // ----- Sessions ------------------------------------------------------------
  async listSessions(req: Request, res: Response): Promise<void> {
    const sessions = await authService.listSessions(req.user!.id, req.user!.sessionId);
    sendSuccess(res, { sessions });
  },

  async revokeSession(req: Request, res: Response): Promise<void> {
    await authService.revokeSession(req.user!.id, req.params.id!);
    sendSuccess(res, { ok: true }, 200, 'Session revoked');
  },
};
