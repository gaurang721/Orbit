'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminStatsDTO,
  AdminUserDTO,
  ReportDTO,
  ReportStatus,
  Role,
} from '@fbclone/types';
import { api } from '@/lib/api-client';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<AdminStatsDTO>('/admin/stats'),
  });
}

export function useAdminReports(status?: ReportStatus) {
  return useInfiniteQuery({
    queryKey: ['admin', 'reports', status ?? 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Page<ReportDTO>>(
        `/admin/reports?limit=20${status ? `&status=${status}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: 'REVIEWING' | 'RESOLVED' | 'DISMISSED'; resolutionNote?: string }) =>
      api.patch<{ report: ReportDTO }>(`/admin/reports/${vars.id}`, {
        status: vars.status,
        resolutionNote: vars.resolutionNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useAdminUsers(q: string, status: 'all' | 'banned' | 'active') {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', q, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Page<AdminUserDTO>>(
        `/admin/users?limit=20&status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; banned: boolean; until?: string; reason?: string }) =>
      api.patch<{ user: AdminUserDTO }>(`/admin/users/${vars.id}/ban`, {
        banned: vars.banned,
        until: vars.until,
        reason: vars.reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; role: Role }) =>
      api.patch<{ user: AdminUserDTO }>(`/admin/users/${vars.id}/role`, { role: vars.role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
