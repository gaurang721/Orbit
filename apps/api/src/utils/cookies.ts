import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { durationToSeconds } from './jwt.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';
// Scope the refresh cookie to the auth routes only.
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseCookieOptions(): CookieOptions {
  const secure = env.COOKIE_SECURE ?? env.isProd;
  // A blank COOKIE_DOMAIN → host-only cookie (binds to whatever host served the
  // request). This lets the same build work on any deploy domain — e.g. behind
  // a same-origin /api proxy — without hardcoding the domain.
  const domain = env.isProd && env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN : undefined;
  return {
    httpOnly: true,
    secure,
    // In production the web app and API can live on different domains (e.g.
    // Vercel + Render), so the refresh cookie must be SameSite=None to be sent
    // cross-site. It requires Secure=true (enforced in prod). Locally we stay Lax.
    sameSite: env.isProd ? 'none' : 'lax',
    domain,
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, token: string, rememberMe: boolean): void {
  const ttl = rememberMe ? env.JWT_REFRESH_EXPIRES_IN_REMEMBER : env.JWT_REFRESH_EXPIRES_IN;
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions(),
    maxAge: durationToSeconds(ttl) * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions());
}
