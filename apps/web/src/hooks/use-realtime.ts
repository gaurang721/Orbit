'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { NotificationDTO } from '@fbclone/types';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { fullName } from '@/lib/utils';
import { patchMessageLocation } from '@/lib/location-cache';
import { NOTIF_COUNT_KEY, NOTIF_LIST_KEY } from './use-notifications';

/** Connect the realtime socket while authenticated and route events into the cache. */
export function useRealtime() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    const socket = connectSocket(token);

    const onNew = (n: NotificationDTO) => {
      qc.invalidateQueries({ queryKey: NOTIF_LIST_KEY });
      qc.invalidateQueries({ queryKey: NOTIF_COUNT_KEY });
      const who = n.actor ? fullName(n.actor) : 'Someone';
      toast(`${who} ${n.message ?? 'sent you a notification'}`);
    };
    const onCount = (data: { unread: number }) => qc.setQueryData(NOTIF_COUNT_KEY, data);
    const onPresence = () => qc.invalidateQueries({ queryKey: ['contacts'] });
    const onMessage = (m: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['messages', m.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      // A call-log arrives as a message too — keep the Calls screen fresh.
      qc.invalidateQueries({ queryKey: ['calls'] });
    };
    const onConversationUpdated = () => qc.invalidateQueries({ queryKey: ['conversations'] });
    // The other person read the thread → refresh so our Seen receipts update.
    const onMessageRead = () => qc.invalidateQueries({ queryKey: ['conversations'] });
    // The other person unsent a message → refresh the thread so it tombstones.
    const onMessageDeleted = (p: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['messages', p.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    // Someone reacted to a message → refetch the thread so reactions update live.
    const onMessageReaction = (p: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['messages', p.conversationId] });
    };
    // A live location moved → patch the card's coordinates in place (no refetch).
    const onLocationUpdate = (p: {
      conversationId: string; messageId: string; latitude: number; longitude: number; updatedAt: string;
    }) => {
      patchMessageLocation(qc, p.conversationId, p.messageId, {
        latitude: p.latitude, longitude: p.longitude, updatedAt: p.updatedAt,
      });
    };
    // A live location was stopped → mark it ended.
    const onLocationEnded = (p: { conversationId: string; messageId: string; endedAt: string }) => {
      patchMessageLocation(qc, p.conversationId, p.messageId, { endedAt: p.endedAt });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('notification:new', onNew);
    socket.on('notification:count', onCount);
    socket.on('presence:update', onPresence);
    socket.on('message:new', onMessage);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:read', onMessageRead);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('message:reaction', onMessageReaction);
    socket.on('location:update', onLocationUpdate);
    socket.on('location:ended', onLocationEnded);

    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:count', onCount);
      socket.off('presence:update', onPresence);
      socket.off('message:new', onMessage);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:read', onMessageRead);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('message:reaction', onMessageReaction);
      socket.off('location:update', onLocationUpdate);
      socket.off('location:ended', onLocationEnded);
    };
  }, [token, qc]);
}
