import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@fbclone/types';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  jti: string; // unique id, also keyed in the RefreshToken table
}

export interface ChallengeTokenPayload {
  sub: string;
  purpose: '2fa';
  rememberMe: boolean;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload, rememberMe: boolean): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: rememberMe ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER : env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

/** Short-lived token issued after the password step of a 2FA login. */
export function sign2FAChallenge(payload: Omit<ChallengeTokenPayload, 'purpose'>): string {
  return jwt.sign({ ...payload, purpose: '2fa' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

export function verify2FAChallenge(token: string): ChallengeTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as ChallengeTokenPayload;
  if (decoded.purpose !== '2fa') throw new Error('Invalid challenge token');
  return decoded;
}

/** Convert a "15m" / "7d" / "30s" duration string to seconds. */
export function durationToSeconds(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(input.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 1);
}
