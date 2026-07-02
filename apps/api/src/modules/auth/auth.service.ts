import type { User } from '@prisma/client';
import type {
  ChangePasswordInput,
  CurrentUser,
  LoginInput,
  RegisterInput,
  Setup2FAResponse,
} from '@fbclone/types';
import { env } from '../../config/env.js';
import { audit } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../lib/mailer.js';
import {
  generateBackupCodes,
  generateToken,
  hashPassword,
  safeEqual,
  sha256,
  verifyPassword,
} from '../../utils/crypto.js';
import { errors } from '../../utils/http-error.js';
import {
  durationToSeconds,
  sign2FAChallenge,
  signAccessToken,
  signRefreshToken,
  verify2FAChallenge,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import {
  buildOtpAuthUrl,
  generateTotpSecret,
  verifyTotp,
} from '../../utils/totp.js';
import { invalidateSession } from '../../middleware/auth.middleware.js';
import { accountStatusError } from './account-status.js';
import { authRepository } from './auth.repository.js';
import type { AuthContext, AuthResult, LoginOutcome } from './auth.types.js';

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

function accessTtlSeconds(): number {
  return durationToSeconds(env.JWT_ACCESS_EXPIRES_IN);
}

function refreshExpiry(rememberMe: boolean): Date {
  const ttl = durationToSeconds(
    rememberMe ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER : env.JWT_REFRESH_EXPIRES_IN,
  );
  return new Date(Date.now() + ttl * 1000);
}

/** Map a Prisma User row to the public CurrentUser DTO. */
export function toCurrentUser(u: User): CurrentUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    email: u.email,
    phone: u.phone,
    profilePicture: u.profilePicture,
    coverPhoto: u.coverPhoto,
    bio: u.bio,
    gender: u.gender,
    birthday: u.birthday ? u.birthday.toISOString() : null,
    relationshipStatus: u.relationshipStatus,
    location: u.location,
    website: u.website,
    verified: u.verified,
    emailVerified: u.emailVerified,
    twoFactorEnabled: u.twoFactorEnabled,
    role: u.role,
    profileVisibility: u.profileVisibility,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/** Create a session + rotating refresh token and mint an access token. */
async function issueSession(user: User, rememberMe: boolean, ctx: AuthContext): Promise<AuthResult> {
  const session = await authRepository.createSession({
    user: { connect: { id: user.id } },
    userAgent: ctx.userAgent,
    ip: ctx.ip,
    deviceName: ctx.deviceName,
    rememberMe,
    expiresAt: refreshExpiry(rememberMe),
  });

  const jti = generateToken(16);
  const refreshToken = signRefreshToken({ sub: user.id, sessionId: session.id, jti }, rememberMe);

  await authRepository.createRefreshToken({
    user: { connect: { id: user.id } },
    session: { connect: { id: session.id } },
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(rememberMe),
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, sessionId: session.id });

  return {
    user: toCurrentUser(user),
    accessToken,
    refreshToken,
    expiresIn: accessTtlSeconds(),
    rememberMe,
  };
}

function assertLoginable(user: User): void {
  const reason = accountStatusError(user);
  if (reason) throw errors.forbidden(reason);
}

export const authService = {
  // ----- Register ------------------------------------------------------------
  async register(input: RegisterInput, ctx: AuthContext): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const phone = input.phone?.trim() || undefined;

    if (await authRepository.existsByEmail(email)) {
      throw errors.conflict('An account with this email already exists');
    }
    if (await authRepository.existsByUsername(input.username)) {
      throw errors.conflict('This username is taken');
    }
    if (phone && (await authRepository.existsByPhone(phone))) {
      throw errors.conflict('An account with this phone number already exists');
    }

    const user = await authRepository.createUser({
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email,
      phone,
      password: await hashPassword(input.password),
    });

    await this.dispatchVerificationEmail(user).catch((err) =>
      logger.warn({ err }, 'Failed to send verification email on register'),
    );
    await audit({ actorId: user.id, action: 'auth.register', entity: 'User', entityId: user.id, ip: ctx.ip, userAgent: ctx.userAgent });

    // Auto-login on register; email verification is required for sensitive features.
    return issueSession(user, false, ctx);
  },

  // ----- Login ---------------------------------------------------------------
  async login(input: LoginInput, ctx: AuthContext): Promise<LoginOutcome> {
    const user = await authRepository.findUserByIdentifier(input.identifier);
    // Run a hash comparison even when the user is missing to blunt timing attacks.
    const ok = user
      ? await verifyPassword(input.password, user.password)
      : await verifyPassword(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinv');

    if (!user || !ok) {
      await audit({ action: 'auth.login.failed', metadata: { identifier: input.identifier }, ip: ctx.ip, userAgent: ctx.userAgent });
      throw errors.unauthorized('Invalid credentials');
    }
    assertLoginable(user);

    if (user.twoFactorEnabled) {
      const challengeToken = sign2FAChallenge({ sub: user.id, rememberMe: input.rememberMe });
      return { twoFactorRequired: true, challengeToken };
    }

    await audit({ actorId: user.id, action: 'auth.login', ip: ctx.ip, userAgent: ctx.userAgent });
    return issueSession(user, input.rememberMe, ctx);
  },

  // ----- Login: second factor ------------------------------------------------
  async loginTwoFactor(challengeToken: string, code: string, ctx: AuthContext): Promise<AuthResult> {
    let payload;
    try {
      payload = verify2FAChallenge(challengeToken);
    } catch {
      throw errors.unauthorized('Two-factor session expired, please log in again');
    }

    const user = await authRepository.findUserById(payload.sub);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw errors.unauthorized('Two-factor authentication is not available');
    }
    assertLoginable(user);

    const valid = await this.consumeTwoFactorCode(user, code);
    if (!valid) {
      await audit({ actorId: user.id, action: 'auth.2fa.failed', ip: ctx.ip, userAgent: ctx.userAgent });
      throw errors.unauthorized('Invalid two-factor code');
    }

    await audit({ actorId: user.id, action: 'auth.login.2fa', ip: ctx.ip, userAgent: ctx.userAgent });
    return issueSession(user, payload.rememberMe, ctx);
  },

  /** Validate a 6-digit TOTP code or a single-use backup code, consuming the latter. */
  async consumeTwoFactorCode(user: User, code: string): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    if (/^\d{6}$/.test(normalized) && user.twoFactorSecret) {
      return verifyTotp(normalized, user.twoFactorSecret);
    }
    // backup code path
    const hashed = sha256(normalized);
    const match = user.twoFactorBackupCodes.find((c) => safeEqual(c, hashed));
    if (!match) return false;
    await authRepository.updateUser(user.id, {
      twoFactorBackupCodes: user.twoFactorBackupCodes.filter((c) => c !== match),
    });
    return true;
  },

  // ----- Refresh (with rotation + reuse detection) ---------------------------
  async refresh(rawToken: string | undefined, _ctx: AuthContext): Promise<AuthResult> {
    if (!rawToken) throw errors.unauthorized('Missing refresh token');

    let payload;
    try {
      payload = verifyRefreshToken(rawToken);
    } catch {
      throw errors.unauthorized('Invalid refresh token');
    }

    const tokenHash = sha256(rawToken);
    const stored = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      // Signature valid but not in store — treat as forged/already-rotated.
      throw errors.unauthorized('Refresh token not recognized');
    }

    if (stored.revokedAt) {
      // Reuse of a rotated/revoked token → likely theft. Nuke the session family.
      await authRepository.revokeRefreshTokensForSession(payload.sessionId);
      await authRepository.revokeSession(payload.sessionId);
      invalidateSession(payload.sessionId);
      await audit({ actorId: payload.sub, action: 'auth.refresh.reuse_detected', entityId: payload.sessionId });
      throw errors.unauthorized('Refresh token has been revoked');
    }

    if (stored.expiresAt < new Date()) throw errors.unauthorized('Refresh token has expired');

    const session = await authRepository.findSession(payload.sessionId);
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw errors.unauthorized('Session is no longer valid');
    }

    const user = await authRepository.findUserById(payload.sub);
    if (!user) throw errors.unauthorized('Account not found');
    assertLoginable(user);

    // Rotate: mint a new refresh token, revoke + link the old one.
    const rememberMe = session.rememberMe;
    const newJti = generateToken(16);
    const newRefresh = signRefreshToken(
      { sub: user.id, sessionId: session.id, jti: newJti },
      rememberMe,
    );
    await authRepository.rotateRefreshToken(stored.id, {
      user: { connect: { id: user.id } },
      session: { connect: { id: session.id } },
      tokenHash: sha256(newRefresh),
      expiresAt: refreshExpiry(rememberMe),
    });
    await authRepository.touchSession(session.id);

    const accessToken = signAccessToken({ sub: user.id, role: user.role, sessionId: session.id });

    return {
      user: toCurrentUser(user),
      accessToken,
      refreshToken: newRefresh,
      expiresIn: accessTtlSeconds(),
      rememberMe,
    };
  },

  // ----- Logout --------------------------------------------------------------
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    try {
      const payload = verifyRefreshToken(rawToken);
      await authRepository.revokeRefreshTokensForSession(payload.sessionId);
      await authRepository.revokeSession(payload.sessionId);
      invalidateSession(payload.sessionId);
      await audit({ actorId: payload.sub, action: 'auth.logout', entityId: payload.sessionId });
    } catch {
      /* already invalid — nothing to revoke */
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await authRepository.revokeAllRefreshTokens(userId);
    await authRepository.revokeAllSessions(userId);
    await audit({ actorId: userId, action: 'auth.logout_all' });
  },

  // ----- Email verification --------------------------------------------------
  async dispatchVerificationEmail(user: User): Promise<void> {
    if (user.emailVerified) return;
    await authRepository.deleteVerificationTokens(user.id, 'EMAIL_VERIFICATION');
    const raw = generateToken();
    await authRepository.createVerificationToken({
      user: { connect: { id: user.id } },
      type: 'EMAIL_VERIFICATION',
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    });
    await sendVerificationEmail(user.email, raw);
  },

  async resendVerification(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    // Always succeed silently — don't leak which emails exist.
    if (user && !user.emailVerified) await this.dispatchVerificationEmail(user);
  },

  async verifyEmail(rawToken: string): Promise<CurrentUser> {
    const record = await authRepository.findVerificationByHash(sha256(rawToken));
    if (
      !record ||
      record.type !== 'EMAIL_VERIFICATION' ||
      record.consumedAt ||
      record.expiresAt < new Date()
    ) {
      throw errors.badRequest('This verification link is invalid or has expired');
    }
    await authRepository.consumeVerificationToken(record.id);
    const user = await authRepository.updateUser(record.userId, { emailVerified: true });
    await audit({ actorId: user.id, action: 'auth.email_verified' });
    return toCurrentUser(user);
  },

  // ----- Password reset ------------------------------------------------------
  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) return; // silent
    await authRepository.deleteVerificationTokens(user.id, 'PASSWORD_RESET');
    const raw = generateToken();
    await authRepository.createVerificationToken({
      user: { connect: { id: user.id } },
      type: 'PASSWORD_RESET',
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    await sendPasswordResetEmail(user.email, raw);
  },

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await authRepository.findVerificationByHash(sha256(rawToken));
    if (
      !record ||
      record.type !== 'PASSWORD_RESET' ||
      record.consumedAt ||
      record.expiresAt < new Date()
    ) {
      throw errors.badRequest('This reset link is invalid or has expired');
    }
    await authRepository.consumeVerificationToken(record.id);
    await authRepository.updateUser(record.userId, { password: await hashPassword(newPassword) });
    // Revoke every session — a password reset invalidates all logins.
    await this.logoutAll(record.userId);
    await audit({ actorId: record.userId, action: 'auth.password_reset' });
  },

  // ----- Change password (authenticated) ------------------------------------
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentSessionId: string,
  ): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw errors.notFound('User not found');
    if (!(await verifyPassword(input.currentPassword, user.password))) {
      throw errors.badRequest('Current password is incorrect');
    }
    await authRepository.updateUser(userId, { password: await hashPassword(input.newPassword) });
    // Keep the current session, revoke the rest.
    await authRepository.revokeAllSessions(userId, currentSessionId);
    await authRepository.revokeAllRefreshTokens(userId);
    await audit({ actorId: userId, action: 'auth.password_changed' });
  },

  // ----- Current user --------------------------------------------------------
  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw errors.notFound('User not found');
    return toCurrentUser(user);
  },

  // ----- Two-factor setup ----------------------------------------------------
  async setup2FA(userId: string): Promise<Setup2FAResponse> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw errors.notFound('User not found');
    if (user.twoFactorEnabled) throw errors.conflict('Two-factor is already enabled');

    const secret = generateTotpSecret();
    // Stage the secret; it only becomes active once a code is verified.
    await authRepository.updateUser(userId, { twoFactorSecret: secret });
    return { secret, otpauthUrl: buildOtpAuthUrl(user.email, secret) };
  },

  async enable2FA(userId: string, code: string): Promise<string[]> {
    const user = await authRepository.findUserById(userId);
    if (!user || !user.twoFactorSecret) {
      throw errors.badRequest('Start two-factor setup first');
    }
    if (!verifyTotp(code.trim(), user.twoFactorSecret)) {
      throw errors.badRequest('Invalid code — please try again');
    }
    const backupCodes = generateBackupCodes();
    await authRepository.updateUser(userId, {
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes.map((c) => sha256(c)),
    });
    await audit({ actorId: userId, action: 'auth.2fa.enabled' });
    return backupCodes; // shown once to the user
  },

  async disable2FA(userId: string, password: string): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) throw errors.notFound('User not found');
    if (!(await verifyPassword(password, user.password))) {
      throw errors.badRequest('Password is incorrect');
    }
    await authRepository.updateUser(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    });
    await audit({ actorId: userId, action: 'auth.2fa.disabled' });
  },

  // ----- Session management --------------------------------------------------
  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await authRepository.listSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      deviceName: s.deviceName,
      rememberMe: s.rememberMe,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  },

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await authRepository.findSession(sessionId);
    if (!session || session.userId !== userId) throw errors.notFound('Session not found');
    await authRepository.revokeRefreshTokensForSession(sessionId);
    await authRepository.revokeSession(sessionId);
    await audit({ actorId: userId, action: 'auth.session.revoked', entityId: sessionId });
  },
};

export type AuthService = typeof authService;
