'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CurrentUser, Paginated, PostDTO, ProfileDTO, PublicUser, UpdateProfileInput } from '@fbclone/types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get<{ profile: ProfileDTO }>(`/users/${username}`),
    enabled: !!username,
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, block }: { username: string; block: boolean }) =>
      api.post(`/users/${username}/${block ? 'block' : 'unblock'}`),
    onSuccess: (_res, { username }) => {
      qc.invalidateQueries({ queryKey: ['profile', username] });
      qc.invalidateQueries({ queryKey: ['blocked-users'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => api.get<{ users: PublicUser[] }>('/users/blocked'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: UpdateProfileInput | FormData) => {
      // FormData → avatar/cover upload endpoints; JSON → PATCH text fields.
      if (input instanceof FormData) {
        const kind = input.get('kind');
        input.delete('kind');
        return api.post<{ user: CurrentUser }>(`/users/me/${kind === 'cover' ? 'cover' : 'avatar'}`, input);
      }
      return api.patch<{ user: CurrentUser }>('/users/me', input);
    },
    onSuccess: ({ user }) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: ['profile', user.username] });
      qc.invalidateQueries({ queryKey: ['user-posts', user.username] });
    },
  });
}

export function useUserPosts(username: string) {
  return useInfiniteQuery({
    queryKey: ['user-posts', username],
    enabled: !!username,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<PostDTO>>(`/users/${username}/posts?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
