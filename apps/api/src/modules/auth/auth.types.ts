import type { CurrentUser, TwoFactorChallenge } from '@fbclone/types';

/** Request-derived context threaded into auth operations. */
export interface AuthContext {
  ip?: string;
  userAgent?: string;
  deviceName?: string;
}

/** Successful authentication: tokens + the current-user payload. */
export interface AuthResult {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  rememberMe: boolean;
}

/** A login may either complete or require a second factor. */
export type LoginOutcome = AuthResult | TwoFactorChallenge;

export function isTwoFactorChallenge(outcome: LoginOutcome): outcome is TwoFactorChallenge {
  return (outcome as TwoFactorChallenge).twoFactorRequired === true;
}
