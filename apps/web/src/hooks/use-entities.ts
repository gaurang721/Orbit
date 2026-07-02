'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventInput,
  CreateGroupInput,
  CreatePageInput,
  EventDTO,
  GroupDTO,
  PageDTO,
  ProductCategoryDTO,
  ProductDTO,
  RSVPStatus,
  UpdateEventInput,
  UpdateGroupInput,
  UpdatePageInput,
  UpdateProductInput,
} from '@fbclone/types';
import { api } from '@/lib/api-client';

// ===== Groups ===============================================================
export const useGroups = () =>
  useQuery({ queryKey: ['groups'], queryFn: () => api.get<{ groups: GroupDTO[] }>('/groups') });
export const useGroup = (slug: string) =>
  useQuery({
    queryKey: ['group', slug],
    queryFn: () => api.get<{ group: GroupDTO; members: Array<{ id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean; role: string }> }>(`/groups/${slug}`),
    enabled: !!slug,
  });
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateGroupInput) => api.post<{ group: GroupDTO }>('/groups', input), onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }) });
}
export function useUpdateGroup(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGroupInput }) =>
      api.patch<{ group: GroupDTO }>(`/groups/${id}`, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['group', slug] }); qc.invalidateQueries({ queryKey: ['groups'] }); },
  });
}
export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}
export function useGroupMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'join' | 'leave' }) => api.post(`/groups/${id}/${action}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); qc.invalidateQueries({ queryKey: ['group'] }); },
  });
}

// ----- Group admin: join requests + member management -----------------------
type GroupRequest = { id: string; user: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean }; createdAt: string };

export const useGroupRequests = (groupId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['group-requests', groupId],
    queryFn: () => api.get<{ requests: GroupRequest[] }>(`/groups/${groupId}/requests`),
    enabled: enabled && !!groupId,
  });

export function useGroupAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, path, body }: { groupId: string; path: string; body?: unknown }) =>
      api.post(`/groups/${groupId}/${path}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-requests'] });
      qc.invalidateQueries({ queryKey: ['group'] });
      qc.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

// ===== Pages ================================================================
export const usePages = () =>
  useQuery({ queryKey: ['pages'], queryFn: () => api.get<{ pages: PageDTO[] }>('/pages') });
export const usePage = (slug: string) =>
  useQuery({ queryKey: ['page', slug], queryFn: () => api.get<{ page: PageDTO }>(`/pages/${slug}`), enabled: !!slug });
export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreatePageInput) => api.post<{ page: PageDTO }>('/pages', input), onSuccess: () => qc.invalidateQueries({ queryKey: ['pages'] }) });
}
export function useUpdatePage(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePageInput }) =>
      api.patch<{ page: PageDTO }>(`/pages/${id}`, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['page', slug] }); qc.invalidateQueries({ queryKey: ['pages'] }); },
  });
}
export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages'] }),
  });
}
export function usePageFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, follow }: { id: string; follow: boolean }) => api.post(`/pages/${id}/${follow ? 'follow' : 'unfollow'}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pages'] }); qc.invalidateQueries({ queryKey: ['page'] }); },
  });
}

// ===== Marketplace ==========================================================
export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ categories: ProductCategoryDTO[] }>('/market/categories'), staleTime: 300_000 });
export const useProducts = (q: string, category: string) =>
  useQuery({
    queryKey: ['products', q, category],
    queryFn: () => api.get<{ products: ProductDTO[] }>(`/market/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}) })}`),
  });
export const useProduct = (id: string) =>
  useQuery({ queryKey: ['product', id], queryFn: () => api.get<{ product: ProductDTO }>(`/market/products/${id}`), enabled: !!id });
export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (fd: FormData) => api.post<{ product: ProductDTO }>('/market/products', fd), onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });
}
export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      api.patch<{ product: ProductDTO }>(`/market/products/${id}`, input),
    onSuccess: ({ product }) => {
      qc.setQueryData(['product', product.id], { product });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/market/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, save }: { id: string; save: boolean }) => api.post(`/market/products/${id}/${save ? 'save' : 'unsave'}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['product'] }); },
  });
}

// ===== Events ===============================================================
export const useEvents = () =>
  useQuery({ queryKey: ['events'], queryFn: () => api.get<{ events: EventDTO[] }>('/events') });
export const useEvent = (id: string) =>
  useQuery({ queryKey: ['event', id], queryFn: () => api.get<{ event: EventDTO }>(`/events/${id}`), enabled: !!id });
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateEventInput) => api.post<{ event: EventDTO }>('/events', input), onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }) });
}
export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => api.patch<{ event: EventDTO }>(`/events/${id}`, input),
    onSuccess: ({ event }) => { qc.setQueryData(['event', id], { event }); qc.invalidateQueries({ queryKey: ['events'] }); },
  });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
export function useRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RSVPStatus }) => api.post(`/events/${id}/rsvp`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['event'] }); },
  });
}
