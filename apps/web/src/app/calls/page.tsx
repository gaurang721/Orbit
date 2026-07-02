'use client';

import * as React from 'react';
import { Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Video } from 'lucide-react';
import type { CallHistoryDTO, UserRef } from '@fbclone/types';
import { SectionShell } from '@/components/layout/section-shell';
import { useCallHistory, useConversations } from '@/hooks/use-chat';
import { useCallStore } from '@/stores/call-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

/** mm:ss for a call duration in seconds. */
function callDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Voice + video call buttons for a given conversation/peer. */
function CallActions({ conversationId, peer }: { conversationId: string; peer: UserRef | null }) {
  const startCall = useCallStore((s) => s.startCall);
  const busy = useCallStore((s) => s.status !== 'idle');
  if (!peer) return null;
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-primary"
        title={busy ? 'Already in a call' : `Voice call ${peer.firstName}`}
        aria-label="Voice call"
        onClick={() => void startCall(conversationId, peer, false)}
        disabled={busy}
      >
        <Phone className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-primary"
        title={busy ? 'Already in a call' : `Video call ${peer.firstName}`}
        aria-label="Video call"
        onClick={() => void startCall(conversationId, peer, true)}
        disabled={busy}
      >
        <Video className="size-5" />
      </Button>
    </div>
  );
}

/** Direction icon, color, and label for a past call. */
function recentMeta(c: CallHistoryDTO): { Icon: typeof Phone; color: string; text: string } {
  const kind = c.media === 'video' ? 'Video' : 'Voice';
  if (c.status === 'missed')
    return {
      Icon: PhoneMissed,
      color: 'text-red-500',
      text: c.outgoing ? `${kind} · No answer` : `Missed ${kind.toLowerCase()} call`,
    };
  if (c.status === 'declined') return { Icon: PhoneOff, color: 'text-red-500', text: `${kind} · Declined` };
  return {
    Icon: c.outgoing ? PhoneOutgoing : PhoneIncoming,
    color: 'text-muted-foreground',
    text: `${c.outgoing ? 'Outgoing' : 'Incoming'} · ${callDuration(c.duration ?? 0)}`,
  };
}

/** Dialer — start a new call by picking someone you've chatted with. */
function Dialer() {
  const { data, isLoading } = useConversations();
  const contacts = (data?.conversations ?? []).filter((c) => c.otherUser);

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold">Start a call</h2>
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && contacts.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No contacts yet. Open someone&apos;s profile and hit Message to start a chat, then call them here.
        </p>
      )}
      <div className="divide-y">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2">
            <div className="relative">
              <Avatar
                src={c.otherUser?.profilePicture}
                name={c.otherUser?.firstName ?? '?'}
                initials={c.otherUser ? initials(c.otherUser) : '?'}
                size={44}
              />
              {c.otherOnline && (
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-green-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{c.otherUser ? fullName(c.otherUser) : 'Conversation'}</div>
              <div className="text-xs text-muted-foreground">{c.otherOnline ? 'Active now' : 'Offline'}</div>
            </div>
            <CallActions conversationId={c.id} peer={c.otherUser} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Recent calls across all conversations. */
function Recent() {
  const { data, isLoading } = useCallHistory();
  const calls = data?.calls ?? [];

  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 font-semibold">Recent</h2>
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && calls.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No recent calls. Start one above — your call history will show up here.
        </p>
      )}
      <div className="divide-y">
        {calls.map((c) => {
          const { Icon, color, text } = recentMeta(c);
          return (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2">
              <Avatar
                src={c.otherUser?.profilePicture}
                name={c.otherUser?.firstName ?? '?'}
                initials={c.otherUser ? initials(c.otherUser) : '?'}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.otherUser ? fullName(c.otherUser) : 'Unknown'}</div>
                <div className={cn('flex items-center gap-1.5 text-xs', color)}>
                  <Icon className="size-3.5" />
                  <span>{text}</span>
                  <span className="text-muted-foreground/70">· {timeAgo(c.createdAt)}</span>
                </div>
              </div>
              <CallActions conversationId={c.conversationId} peer={c.otherUser} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function CallsPage() {
  return (
    <SectionShell title="Calls" max="max-w-2xl">
      <Dialer />
      <Recent />
    </SectionShell>
  );
}
