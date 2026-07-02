'use client';

import * as React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConversationDTO, MessageDTO } from '@fbclone/types';
import { useConversations, useForwardMessage } from '@/hooks/use-chat';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { fullName, initials } from '@/lib/utils';

function previewText(m: MessageDTO): string {
  if (m.type === 'VOICE') return '🎤 Voice message';
  if (m.content) return m.content;
  return 'Attachment';
}

/** Pick conversations to forward a message into. Stays open so you can send to several. */
export function ForwardDialog({
  message,
  currentConversationId,
  onClose,
}: {
  message: MessageDTO;
  currentConversationId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useConversations();
  const forward = useForwardMessage();
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const convs = (data?.conversations ?? []).filter((c) => c.id !== currentConversationId);

  const send = async (c: ConversationDTO) => {
    if (doneIds.has(c.id) || pendingId) return;
    setPendingId(c.id);
    try {
      await forward.mutateAsync({ targetConversationId: c.id, messageId: message.id });
      setDoneIds((prev) => new Set(prev).add(c.id));
      toast.success(`Forwarded to ${c.otherUser ? fullName(c.otherUser) : 'conversation'}`);
    } catch {
      toast.error('Could not forward message');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col animate-scale-in rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Forward to…</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        <div className="border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          <span className="block truncate">{previewText(message)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          )}
          {!isLoading && convs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No other chats to forward to.</p>
          )}
          {convs.map((c) => {
            const done = doneIds.has(c.id);
            const busy = pendingId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => send(c)}
                disabled={done || busy}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent disabled:opacity-70"
              >
                <Avatar
                  src={c.otherUser?.profilePicture}
                  name={c.otherUser?.firstName ?? '?'}
                  initials={c.otherUser ? initials(c.otherUser) : '?'}
                  size={40}
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {c.otherUser ? fullName(c.otherUser) : 'Conversation'}
                </span>
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : done ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <span className="text-xs font-semibold text-primary">Send</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
