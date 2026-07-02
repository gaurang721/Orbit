'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StoryGroupDTO, StoryViewerDTO } from '@fbclone/types';
import { api } from '@/lib/api-client';

export function useStories() {
  return useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<{ groups: StoryGroupDTO[] }>('/stories'),
    refetchInterval: 60_000,
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData | { caption?: string; backgroundColor?: string }) =>
      api.post('/stories', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  });
}

export function useViewStory() {
  return useMutation({
    mutationFn: (storyId: string) => api.post(`/stories/${storyId}/view`),
  });
}

export function useReactStory() {
  return useMutation({
    mutationFn: ({ storyId, emoji }: { storyId: string; emoji: string }) =>
      api.post(`/stories/${storyId}/react`, { emoji }),
  });
}

export function useStoryViewers(storyId: string | null) {
  return useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: () => api.get<{ viewers: StoryViewerDTO[] }>(`/stories/${storyId}/viewers`),
    enabled: !!storyId,
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: string) => api.delete(`/stories/${storyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  });
}
