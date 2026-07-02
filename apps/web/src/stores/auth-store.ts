import { create } from 'zustand';
import type { CurrentUser } from '@fbclone/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: CurrentUser | null;
  accessToken: string | null;
  status: AuthStatus;
  setAuth: (user: CurrentUser, accessToken: string) => void;
  setUser: (user: CurrentUser) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

/**
 * Auth state lives in memory only — the access token is never persisted to
 * localStorage (XSS-safe). The httpOnly refresh cookie re-hydrates the session
 * on load via /auth/refresh.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setAuth: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));
