'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Paginated, PostDTO, ProductDTO, SearchResults } from '@fbclone/types';
import { api } from '@/lib/api-client';

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 1,
  });
}

export function useVideos() {
  return useInfiniteQuery({
    queryKey: ['videos'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<PostDTO>>(`/posts/videos?limit=8${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSavedPosts() {
  return useQuery({ queryKey: ['saved-posts'], queryFn: () => api.get<{ posts: PostDTO[] }>('/posts/saved') });
}

export function useSavedProducts() {
  return useQuery({ queryKey: ['saved-products'], queryFn: () => api.get<{ products: ProductDTO[] }>('/market/saved') });
}
