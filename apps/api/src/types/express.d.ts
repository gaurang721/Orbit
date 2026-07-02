import type { Role } from '@fbclone/types';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      role: Role;
      sessionId: string;
    }
    interface Request {
      /** Per-request correlation id (set by requestContext middleware). */
      id: string;
      /** Populated by requireAuth / optionalAuth. */
      user?: AuthUser;
    }
  }
}

export {};
