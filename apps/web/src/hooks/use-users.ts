'use client';

import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@fbclone/types';
import { api } from '@/lib/api-client';

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get<{ users: PublicUser[] }>('/users/contacts'),
    staleTime: 60_000,
  });
}
