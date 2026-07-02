'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDTO, Paginated } from '@fbclone/types';
import { api } from '@/lib/api-client';

export const NOTIF_COUNT_KEY = ['notif-count'];
export const NOTIF_LIST_KEY = ['notifs'];

export function useUnreadCount() {
  return useQuery({
    queryKey: NOTIF_COUNT_KEY,
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    staleTime: 30_000,
  });
}

export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: NOTIF_LIST_KEY,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<NotificationDTO>>(`/notifications?limit=15${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/notifications/read-all'),
    onSuccess: () => {
      qc.setQueryData(NOTIF_COUNT_KEY, { unread: 0 });
      qc.invalidateQueries({ queryKey: NOTIF_LIST_KEY });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean }>(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIF_COUNT_KEY });
      qc.invalidateQueries({ queryKey: NOTIF_LIST_KEY });
    },
  });
}
