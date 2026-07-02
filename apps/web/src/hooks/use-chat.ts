'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { CallHistoryDTO, ConversationDTO, ConversationMemberDTO, MessageDTO, Paginated } from '@fbclone/types';
import { api } from '@/lib/api-client';

type MsgData = InfiniteData<Paginated<MessageDTO>>;

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: ConversationDTO[] }>('/chat/conversations'),
    refetchInterval: 20_000,
  });
}

export function useCallHistory() {
  return useQuery({
    queryKey: ['calls'],
    queryFn: () => api.get<{ calls: CallHistoryDTO[] }>('/chat/calls'),
  });
}

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<MessageDTO>>(
        `/chat/conversations/${conversationId}/messages?limit=25${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/messages`, { content }),
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendVoiceMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ blob, duration }: { blob: Blob; duration: number }) => {
      const form = new FormData();
      // Give the part a filename so multer/Express infer a sane extension.
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      form.append('voice', blob, `voice.${ext}`);
      form.append('duration', String(duration));
      return api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/voice`, form);
    },
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendFileMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file, file.name);
      return api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/file`, form);
    },
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendChatMedia(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('media', file, file.name);
      return api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/media`, form);
    },
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendLocation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (loc: { latitude: number; longitude: number; label?: string }) =>
      api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/location`, loc),
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/** Stop a live-location share via the API (fallback when the live store isn't
 *  driving it — e.g. after a reload). The store handles the common case. */
export function useStopLiveLocation(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/location/${messageId}/stop`),
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((m) => (m.id === message.id ? message : m)),
          })),
        };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReactToMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string | null }) =>
      emoji === null
        ? api.delete<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/messages/${messageId}/react`)
        : api.post<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/messages/${messageId}/react`, { emoji }),
    onSuccess: ({ message }) => {
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((m) => (m.id === message.id ? message : m)),
          })),
        };
      });
    },
  });
}

export function useForwardMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetConversationId, messageId }: { targetConversationId: string; messageId: string }) =>
      api.post<{ message: MessageDTO }>(`/chat/conversations/${targetConversationId}/forward`, { messageId }),
    onSuccess: ({ message }) => {
      // Prepend into the target thread's cache if it's already loaded, then
      // refresh the conversation list (preview + ordering).
      qc.setQueryData<MsgData>(['messages', message.conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete<{ message: MessageDTO }>(`/chat/conversations/${conversationId}/messages/${messageId}`),
    onSuccess: ({ message }) => {
      // Replace the message in the thread cache with its deleted tombstone.
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((m) => (m.id === message.id ? message : m)),
          })),
        };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post<{ conversation: ConversationDTO }>('/chat/conversations', { userId }),
    onSuccess: ({ conversation }) => {
      // Seed the list so the Messages page can find + open it right away,
      // then refetch to reconcile with the server.
      qc.setQueryData<{ conversations: ConversationDTO[] }>(['conversations'], (data) => {
        const list = data?.conversations ?? [];
        if (list.some((c) => c.id === conversation.id)) return data;
        return { conversations: [conversation, ...list] };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useStartGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, memberIds }: { name: string; memberIds: string[] }) =>
      api.post<{ conversation: ConversationDTO }>('/chat/conversations/group', { name, memberIds }),
    onSuccess: ({ conversation }) => {
      qc.setQueryData<{ conversations: ConversationDTO[] }>(['conversations'], (data) => {
        const list = data?.conversations ?? [];
        if (list.some((c) => c.id === conversation.id)) return data;
        return { conversations: [conversation, ...list] };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// ----- Group management -----------------------------------------------------
export function useConversationMembers(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['conversation-members', conversationId],
    enabled: enabled && !!conversationId,
    queryFn: () => api.get<{ members: ConversationMemberDTO[] }>(`/chat/conversations/${conversationId}/members`),
  });
}

export function useRenameGroup(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.patch(`/chat/conversations/${conversationId}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-members', conversationId] });
    },
  });
}

export function useAddGroupMembers(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberIds: string[]) => api.post(`/chat/conversations/${conversationId}/members`, { memberIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-members', conversationId] });
    },
  });
}

export function useRemoveGroupMember(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/chat/conversations/${conversationId}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation-members', conversationId] });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.post(`/chat/conversations/${conversationId}/leave`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => api.post(`/chat/conversations/${conversationId}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}
