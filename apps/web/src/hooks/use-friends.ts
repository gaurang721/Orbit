'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FriendRequestDTO, PersonCardDTO, PublicUser } from '@fbclone/types';
import { api } from '@/lib/api-client';

function useInvalidateFriends() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['friends'] });
    qc.invalidateQueries({ queryKey: ['friend-requests'] });
    qc.invalidateQueries({ queryKey: ['suggestions'] });
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['contacts'] });
  };
}

export function useFriends() {
  return useQuery({ queryKey: ['friends'], queryFn: () => api.get<{ friends: PublicUser[] }>('/friends') });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => api.get<{ requests: FriendRequestDTO[] }>('/friends/requests'),
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get<{ suggestions: PersonCardDTO[] }>('/friends/suggestions'),
  });
}

export function useSendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (userId: string) => api.post('/friends/requests', { userId }),
    onSuccess: invalidate,
  });
}

export function useRespondRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api.post(`/friends/requests/${id}/${accept ? 'accept' : 'reject'}`),
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/friends/requests/${id}`),
    onSuccess: invalidate,
  });
}

export function useUnfriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/friends/${userId}`),
    onSuccess: invalidate,
  });
}

export function useFollow() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) =>
      follow ? api.post('/friends/follow', { userId }) : api.delete(`/friends/follow/${userId}`),
    onSuccess: invalidate,
  });
}
