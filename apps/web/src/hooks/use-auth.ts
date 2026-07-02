'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  CurrentUser,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TwoFactorChallenge,
} from '@fbclone/types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export interface AuthSuccess {
  user: CurrentUser;
  accessToken: string;
  expiresIn: number;
}
export type LoginResponse = AuthSuccess | TwoFactorChallenge;

function isChallenge(r: LoginResponse): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).twoFactorRequired === true;
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<AuthSuccess>('/auth/register', input),
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<LoginResponse>('/auth/login', input),
    onSuccess: (data) => {
      if (!isChallenge(data)) setAuth(data.user, data.accessToken);
    },
  });
}

export function useLoginTwoFactor() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (input: { challengeToken: string; code: string }) =>
      api.post<AuthSuccess>('/auth/login/2fa', input),
    onSuccess: (data) => setAuth(data.user, data.accessToken),
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/auth/logout'),
    onSettled: () => clear(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => api.post<{ ok: boolean }>('/auth/forgot-password', input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => api.post<{ ok: boolean }>('/auth/reset-password', input),
  });
}

export function useVerifyEmail() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (token: string) => api.post<{ user: CurrentUser }>('/auth/verify-email', { token }),
    onSuccess: (data) => setUser(data.user),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => api.post<{ ok: boolean }>('/auth/resend-verification', { email }),
  });
}

export { isChallenge };
