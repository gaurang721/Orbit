import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@fbclone/types';
import { accountStatusError } from '../modules/auth/account-status.js';
import { authRepository } from '../modules/auth/auth.repository.js';
import { errors } from '../utils/http-error.js';
import { verifyAccessToken } from '../utils/jwt.js';

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Per-request validation beyond the JWT signature: an access token is valid for
 * its full 15-minute TTL, so without this a banned user, a "log out everywhere",
 * or a role change wouldn't take effect until the token expired. We re-check the
 * session + account against the DB, but cache the positive result briefly so this
 * isn't a database round-trip on every single authenticated request.
 */
const SESSION_RECHECK_MS = 20_000;
const MAX_CACHE_ENTRIES = 10_000;
const sessionCache = new Map<string, { role: Role; until: number }>();

function getCachedRole(sessionId: string): Role | null {
  const hit = sessionCache.get(sessionId);
  if (!hit) return null;
  if (hit.until <= Date.now()) {
    sessionCache.delete(sessionId);
    return null;
  }
  return hit.role;
}

function cacheRole(sessionId: string, role: Role): void {
  // Crude but bounded: drop everything if we somehow accumulate too many.
  if (sessionCache.size >= MAX_CACHE_ENTRIES) sessionCache.clear();
  sessionCache.set(sessionId, { role, until: Date.now() + SESSION_RECHECK_MS });
}

/** Forget a cached session immediately (e.g. on logout) so it can't be reused. */
export function invalidateSession(sessionId: string): void {
  sessionCache.delete(sessionId);
}

interface Principal {
  id: string;
  role: Role;
  sessionId: string;
}

async function resolvePrincipal(payload: {
  sub: string;
  role: Role;
  sessionId: string;
}): Promise<Principal> {
  const cachedRole = getCachedRole(payload.sessionId);
  if (cachedRole) {
    return { id: payload.sub, role: cachedRole, sessionId: payload.sessionId };
  }

  const session = await authRepository.findSessionWithUser(payload.sessionId);
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw errors.unauthorized('Session is no longer valid');
  }
  if (session.userId !== payload.sub) {
    throw errors.unauthorized('Invalid session');
  }
  const reason = accountStatusError(session.user);
  if (reason) throw errors.forbidden(reason);

  cacheRole(session.id, session.user.role);
  // Use the freshly-read role, not the (possibly stale) one from the token.
  return { id: session.user.id, role: session.user.role, sessionId: session.id };
}

/** Require a valid access token AND a live, non-revoked session; else 401/403. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next(errors.unauthorized('Missing access token'));
    return;
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    next(errors.unauthorized('Invalid or expired access token'));
    return;
  }
  resolvePrincipal(payload)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

/** Attach req.user when a valid token is present, but never reject. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
}

const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/** Require the authenticated user to hold at least the given role. */
export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(errors.unauthorized());
      return;
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      next(errors.forbidden());
      return;
    }
    next();
  };
}
