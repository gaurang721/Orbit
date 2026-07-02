'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export interface SessionInfo {
  id: string;
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
  rememberMe: boolean;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
}

export function useSetup2FA() {
  return useMutation({
    mutationFn: () =>
      api.post<{ secret: string; otpauthUrl: string; qrDataUrl: string }>('/auth/2fa/setup'),
  });
}

export function useEnable2FA() {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (code: string) => api.post<{ backupCodes: string[] }>('/auth/2fa/enable', { code }),
    onSuccess: () => {
      if (user) setUser({ ...user, twoFactorEnabled: true });
    },
  });
}

export function useDisable2FA() {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (password: string) => api.post<{ ok: boolean }>('/auth/2fa/disable', { password }),
    onSuccess: () => {
      if (user) setUser({ ...user, twoFactorEnabled: false });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ sessions: SessionInfo[] }>('/auth/sessions'),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/auth/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}
