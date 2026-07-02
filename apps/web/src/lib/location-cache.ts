import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { MessageDTO, Paginated } from '@fbclone/types';

type MsgData = InfiniteData<Paginated<MessageDTO>>;

/**
 * Patch a single message's `location` fields inside the thread cache — used for
 * live-location movement (fresh coordinates / updatedAt) and end events, so the
 * card updates without a full refetch. No-ops if the message isn't a location.
 */
export function patchMessageLocation(
  qc: QueryClient,
  conversationId: string,
  messageId: string,
  patch: Partial<NonNullable<MessageDTO['location']>>,
): void {
  qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.map((m) =>
          m.id === messageId && m.location ? { ...m, location: { ...m.location, ...patch } } : m,
        ),
      })),
    };
  });
}
