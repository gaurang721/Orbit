import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { errors } from '../utils/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lightweight CSRF defense for cookie-bearing, state-changing requests.
 *
 * The API is primarily Bearer-token authenticated (immune to CSRF), but the
 * refresh-token cookie is not. For mutating requests that carry an Origin or
 * Referer header, we require it to match an allowed origin. Combined with the
 * SameSite cookie attribute this blocks cross-site forgery without breaking
 * legitimate same-origin/native clients (which may omit Origin entirely).
 */
export function verifyOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.header('origin');
  const referer = req.header('referer');
  const source = origin ?? referer;

  // No Origin/Referer (e.g. server-to-server, mobile app, curl) — allow; such
  // clients use the Authorization header, not ambient cookies.
  if (!source) {
    next();
    return;
  }
  const allowed = env.corsOrigins.some((o) => source === o || source.startsWith(`${o}/`));
  if (!allowed) {
    next(errors.forbidden('Cross-origin request blocked'));
    return;
  }
  next();
}
