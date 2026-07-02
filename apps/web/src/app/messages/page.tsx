'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, Check, CheckCheck, Copy, CornerUpRight, FileAudio, Forward, Image as ImageIcon, Info, Loader2, MapPin, MoreHorizontal, Paperclip, Phone, PhoneMissed, Plus, SendHorizontal, Smile, Trash2, Users, Video } from 'lucide-react';
import { toast } from 'sonner';
import type { CallLog, ConversationDTO, MessageDTO, UserRef } from '@fbclone/types';
import { parseCallLog, parseLocation } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { confirmDialog } from '@/stores/confirm-store';
import { AuthGuard } from '@/components/auth-guard';
import { TopNav } from '@/components/layout/top-nav';
import {
  useConversations,
  useDeleteMessage,
  useMarkConversationRead,
  useMessages,
  useReactToMessage,
  useSendChatMedia,
  useSendFileMessage,
  useSendLocation,
  useSendMessage,
  useSendVoiceMessage,
  useStopLiveLocation,
} from '@/hooks/use-chat';
import { useLiveLocationStore } from '@/stores/live-location-store';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VoiceMessage } from '@/components/chat/voice-message';
import { VoiceRecorder } from '@/components/chat/voice-recorder';
import { DOC_ACCEPT, FileAttachment } from '@/components/ui/file-attachment';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { RichText } from '@/components/ui/rich-text';
import { VideoPlayer } from '@/components/ui/video-player';
import { ForwardDialog } from '@/components/chat/forward-dialog';
import { GroupInfoDialog } from '@/components/chat/group-info-dialog';
import { LocationComposer } from '@/components/chat/location-composer';
import { LocationMessage } from '@/components/chat/location-message';
import { MessageInfoDialog } from '@/components/chat/message-info-dialog';
import { NewGroupDialog } from '@/components/chat/new-group-dialog';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

/** Read an audio file's duration (seconds) via a temporary <audio> element.
 *  Resolves 0 if the format doesn't expose metadata (the player derives it later). */
function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    const done = (d: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : 0); };
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
  });
}

/** Short preview text for a conversation's latest message. */
function previewText(msg: ConversationDTO['lastMessage']): string {
  if (!msg) return 'Say hi 👋';
  if (msg.deleted) return 'Unsent a message';
  if (msg.type === 'VOICE') return '🎤 Voice message';
  if (msg.type === 'IMAGE') return '📷 Photo';
  if (msg.type === 'VIDEO') return '🎥 Video';
  if (msg.type === 'FILE') return '📎 Attachment';
  const loc = parseLocation(msg.content);
  if (loc) return loc.live ? '📍 Live location' : '📍 Location';
  if (msg.type === 'SYSTEM') {
    const log = parseCallLog(msg.content);
    if (log) {
      const icon = log.media === 'video' ? '🎥' : '📞';
      const label =
        log.status === 'answered' ? 'Call ended' : log.status === 'declined' ? 'Call declined' : 'Missed call';
      return `${icon} ${label}`;
    }
  }
  return msg.content ?? 'Sent an attachment';
}

/** mm:ss for a call duration in seconds. */
function callDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Human label for a call-log pill, phrased from the viewer's perspective. */
function callLogLabel(log: CallLog, isOwn: boolean): string {
  const kind = log.media === 'video' ? 'Video call' : 'Voice call';
  if (log.status === 'answered') return `${kind} · ${callDuration(log.duration ?? 0)}`;
  if (log.status === 'declined') return isOwn ? `${kind} · Declined` : `${kind} declined`;
  return isOwn ? `${kind} · No answer` : `Missed ${kind.toLowerCase()}`;
}

/** Display name for a conversation — group name (or member names), else the other user. */
function conversationTitle(c: ConversationDTO): string {
  if (c.isGroup) return c.name?.trim() || c.members.map((mm) => mm.firstName).join(', ') || 'Group';
  return c.otherUser ? fullName(c.otherUser) : 'Conversation';
}

/** Preview line, prefixed with the sender's name in group chats. */
function conversationPreview(c: ConversationDTO): string {
  const base = previewText(c.lastMessage);
  const last = c.lastMessage;
  if (!c.isGroup || !last || last.deleted || last.type === 'SYSTEM') return base;
  // members excludes me, so an unfound sender means it was my own message.
  const who = c.members.find((mm) => mm.id === last.senderId)?.firstName ?? 'You';
  return `${who}: ${base}`;
}

/** Avatar for a conversation — a group glyph for groups, else the other user. */
function ConversationAvatar({ c, size = 48 }: { c: ConversationDTO; size?: number }) {
  if (c.isGroup) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-full bg-primary/15 text-primary"
        aria-label={conversationTitle(c)}
      >
        <Users className={size >= 44 ? 'size-6' : 'size-5'} />
      </div>
    );
  }
  return (
    <Avatar
      src={c.otherUser?.profilePicture}
      name={c.otherUser?.firstName ?? '?'}
      initials={c.otherUser ? initials(c.otherUser) : '?'}
      size={size}
    />
  );
}

function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (c: ConversationDTO) => void;
}) {
  const { data, isLoading } = useConversations();
  const convs = data?.conversations ?? [];
  const [showNewGroup, setShowNewGroup] = React.useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold">Chats</h1>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-primary"
          title="New group"
          aria-label="New group"
          onClick={() => setShowNewGroup(true)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {!isLoading && convs.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No chats yet. Open someone&apos;s profile and hit Message, or start a group with the + above.
          </p>
        )}
        {convs.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent',
              activeId === c.id && 'bg-accent',
            )}
          >
            <div className="relative">
              <ConversationAvatar c={c} size={48} />
              {c.otherOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-green-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold">{conversationTitle(c)}</span>
                {c.unreadCount > 0 && (
                  <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-muted-foreground">
                {conversationPreview(c)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {showNewGroup && (
        <NewGroupDialog
          onClose={() => setShowNewGroup(false)}
          onCreated={(conversation) => onSelect(conversation)}
        />
      )}
    </div>
  );
}

/** Short clock time shown under a message, e.g. "5:24 PM". */
function messageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** One message bubble with a hover ⋯ menu (Forward / Copy / Message info). */
function MessageRow({
  message,
  showSender = false,
  onForward,
  onInfo,
  onDelete,
  onStopLive,
}: {
  message: MessageDTO;
  /** show the sender's avatar + name (group chats, others' messages) */
  showSender?: boolean;
  onForward: (m: MessageDTO) => void;
  onInfo: (m: MessageDTO) => void;
  onDelete: (m: MessageDTO) => void;
  onStopLive: (m: MessageDTO) => void;
}) {
  const m = message;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [reactOpen, setReactOpen] = React.useState(false);
  const react = useReactToMessage(m.conversationId);
  const myReaction = m.reactions.find((r) => r.reactedByMe)?.emoji ?? null;

  // A call log is a centered system pill (no bubble, no actions).
  const callLog = m.type === 'SYSTEM' ? parseCallLog(m.content) : null;
  if (callLog) {
    const failed = callLog.status !== 'answered';
    const Icon = failed ? PhoneMissed : callLog.media === 'video' ? Video : Phone;
    return (
      <div className="flex justify-center py-1.5">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs',
            failed ? 'text-red-500' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" />
          <span>{callLogLabel(callLog, m.isOwn)}</span>
          <span className="text-muted-foreground/70">· {messageTime(m.createdAt)}</span>
        </div>
      </div>
    );
  }

  // A deleted ("unsent") message is a plain tombstone — no actions, no content.
  if (m.deleted) {
    return (
      <div className={cn('group flex items-end gap-1', m.isOwn ? 'justify-end' : 'justify-start')}>
        <div className={cn('flex max-w-[75%] flex-col gap-0.5', m.isOwn ? 'items-end' : 'items-start')}>
          <div className="flex w-fit items-center gap-1.5 rounded-2xl border border-dashed px-3.5 py-2 text-[13px] italic text-muted-foreground">
            <Ban className="size-3.5" />
            {m.isOwn ? 'You unsent a message' : 'This message was deleted'}
          </div>
          <span className="px-1 text-[10px] text-muted-foreground">{messageTime(m.createdAt)}</span>
        </div>
      </div>
    );
  }

  const copy = async () => {
    setMenuOpen(false);
    if (!m.content) return;
    try {
      await navigator.clipboard.writeText(m.content);
      toast.success('Copied to clipboard');
    } catch {
      toast.message(m.content);
    }
  };

  const menu = (
    <div className="relative self-center">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-accent group-hover:opacity-100"
        aria-label="Message actions"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div
            className={cn(
              'absolute top-8 z-20 w-40 animate-scale-in rounded-xl border bg-card py-1 shadow-2xl',
              m.isOwn ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            )}
          >
            <button
              onClick={() => { setMenuOpen(false); onForward(m); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <Forward className="size-4" /> Forward
            </button>
            {m.content && (
              <button onClick={copy} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
                <Copy className="size-4" /> Copy
              </button>
            )}
            <button
              onClick={() => { setMenuOpen(false); onInfo(m); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <Info className="size-4" /> Message info
            </button>
            {m.isOwn && (
              <button
                onClick={() => { setMenuOpen(false); onDelete(m); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="size-4" /> Unsend
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Photo/video/file/location messages render as bare cards (no colored bubble).
  const bareMedia =
    !!m.location ||
    (!!m.attachments[0] && (m.type === 'IMAGE' || m.type === 'VIDEO' || m.type === 'FILE'));

  // Hover affordance to react with a quick emoji.
  const reactControl = m.deleted ? null : (
    <div className="relative self-center opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={() => setReactOpen((v) => !v)}
        className="rounded-full p-1 text-muted-foreground hover:bg-accent"
        aria-label="React to message"
        title="React"
      >
        <Smile className="size-4" />
      </button>
      {reactOpen && (
        <>
          <button type="button" aria-hidden className="fixed inset-0 z-40" onClick={() => setReactOpen(false)} />
          <div className="absolute bottom-full left-1/2 z-50 mb-1 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card px-2 py-1 shadow-xl">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { react.mutate({ messageId: m.id, emoji: myReaction === e ? null : e }); setReactOpen(false); }}
                className={cn('text-xl transition-transform hover:scale-125', myReaction === e && 'scale-110')}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={cn('group flex items-end gap-1', m.isOwn ? 'justify-end' : 'justify-start')}>
      {m.isOwn && (<>{reactControl}{menu}</>)}
      {showSender && (
        <Avatar
          src={m.sender.profilePicture}
          name={m.sender.firstName}
          initials={initials(m.sender)}
          size={28}
          className="mb-5 shrink-0"
        />
      )}
      <div className={cn('flex max-w-[75%] flex-col gap-0.5', m.isOwn ? 'items-end' : 'items-start')}>
        {showSender && (
          <span className="px-1 text-[11px] font-medium text-muted-foreground">{m.sender.firstName}</span>
        )}
        <div
          className={cn(
            'w-fit max-w-full animate-scale-in rounded-2xl text-[15px]',
            m.type === 'VOICE'
              ? 'px-2 py-1.5'
              : bareMedia
                ? 'overflow-hidden p-0'
                : 'px-3.5 py-2',
            bareMedia
              ? ''
              : m.isOwn
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground',
          )}
          title={timeAgo(m.createdAt)}
        >
          {m.forwarded && (
            <div
              className={cn(
                'flex items-center gap-1 text-[11px] italic',
                bareMedia ? 'px-2 pt-1' : 'mb-0.5',
                m.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground',
              )}
            >
              <CornerUpRight className="size-3" /> Forwarded
            </div>
          )}
          {m.location ? (
            <LocationMessage
              location={m.location}
              isOwn={m.isOwn}
              onStop={() => onStopLive(m)}
              className="w-64 max-w-full"
            />
          ) : m.type === 'VOICE' && m.attachments[0] ? (
            <VoiceMessage url={m.attachments[0].url} duration={m.voiceDuration} own={m.isOwn} />
          ) : m.type === 'IMAGE' && m.attachments[0] ? (
            <a href={m.attachments[0].url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.attachments[0].url} alt="" className="max-h-80 w-full max-w-[280px] object-cover" loading="lazy" />
            </a>
          ) : m.type === 'VIDEO' && m.attachments[0] ? (
            <VideoPlayer src={m.attachments[0].url} className="max-h-80 max-w-[280px]" />
          ) : m.type === 'FILE' && m.attachments[0] ? (
            <FileAttachment
              url={m.attachments[0].url}
              fileName={m.attachments[0].fileName}
              size={m.attachments[0].size}
              mimeType={m.attachments[0].mimeType}
              className="w-60 max-w-full"
            />
          ) : (
            <RichText
              text={m.content ?? ''}
              className="whitespace-pre-wrap break-words"
              linkClassName={cn(
                'font-semibold underline underline-offset-2',
                m.isOwn ? 'text-primary-foreground' : 'text-primary',
              )}
            />
          )}
        </div>
        {m.reactions.length > 0 && (
          <div className={cn('flex flex-wrap gap-1', m.isOwn ? 'justify-end' : 'justify-start')}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => react.mutate({ messageId: m.id, emoji: r.reactedByMe ? null : r.emoji })}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs',
                  r.reactedByMe ? 'border-primary bg-primary/10 text-primary' : 'bg-card',
                )}
                title={r.reactedByMe ? 'Remove your reaction' : 'React'}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
        <span className="px-1 text-[10px] text-muted-foreground">{messageTime(m.createdAt)}</span>
      </div>
      {!m.isOwn && (<>{menu}{reactControl}</>)}
    </div>
  );
}

function ChatThread({ conversation, onLeave }: { conversation: ConversationDTO; onLeave?: () => void }) {
  const me = useAuthStore((s) => s.user)!;
  const { data, isLoading } = useMessages(conversation.id);
  const { data: convData } = useConversations();
  const send = useSendMessage(conversation.id);
  const sendVoice = useSendVoiceMessage(conversation.id);
  const sendFile = useSendFileMessage(conversation.id);
  const sendMedia = useSendChatMedia(conversation.id);
  const sendLocation = useSendLocation(conversation.id);
  const stopLive = useStopLiveLocation(conversation.id);
  const liveStop = useLiveLocationStore((s) => s.stop);
  const liveActive = useLiveLocationStore((s) => s.active);
  const deleteMessage = useDeleteMessage(conversation.id);
  const markRead = useMarkConversationRead();
  const [text, setText] = React.useState('');
  const [recording, setRecording] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [showLocation, setShowLocation] = React.useState(false);
  const [showGroupInfo, setShowGroupInfo] = React.useState(false);
  // @mention autocomplete state (group chats): the active token + highlighted row
  const [mention, setMention] = React.useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  // who is currently typing, keyed by userId → first name (groups can have several)
  const [typingMap, setTypingMap] = React.useState<Record<string, string>>({});
  const [forwardMsg, setForwardMsg] = React.useState<MessageDTO | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<MessageDTO | null>(null);
  const bottom = React.useRef<HTMLDivElement>(null);
  const docInput = React.useRef<HTMLInputElement>(null);
  const audioInput = React.useRef<HTMLInputElement>(null);
  const mediaInput = React.useRef<HTMLInputElement>(null);
  const composerInput = React.useRef<HTMLInputElement>(null);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const otherId = conversation.otherUser?.id;
  const startCall = useCallStore((s) => s.startCall);
  const callBusy = useCallStore((s) => s.status !== 'idle');

  const onStartCall = (video: boolean) => {
    if (conversation.otherUser) void startCall(conversation.id, conversation.otherUser, video);
  };

  // Prefer the live conversation from the cache (otherLastReadAt updates as the
  // other person reads); fall back to the snapshot passed in.
  const liveConv = convData?.conversations.find((c) => c.id === conversation.id) ?? conversation;

  // oldest → newest
  const messages = (data?.pages.flatMap((p) => p.items) ?? []).slice().reverse();

  const typingNames = Object.values(typingMap);
  const anyTyping = typingNames.length > 0;

  // Seen receipt for our own latest message (call-log system pills don't count).
  const lastOwn = [...messages].reverse().find((mm) => mm.isOwn && mm.type !== 'SYSTEM');
  const lastOwnSeen =
    !!lastOwn &&
    liveConv.otherLastReadAt != null &&
    new Date(liveConv.otherLastReadAt).getTime() >= new Date(lastOwn.createdAt).getTime();

  React.useEffect(() => {
    markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, messages.length]);

  React.useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, anyTyping]);

  // listen for other participants typing (resolve their name from the members)
  React.useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const timers = typingTimers.current;
    const onTyping = (p: { conversationId: string; fromUserId?: string; isTyping: boolean }) => {
      if (p.conversationId !== conversation.id || !p.fromUserId) return;
      const fromId = p.fromUserId;
      if (p.isTyping) {
        const name = conversation.members.find((mm) => mm.id === fromId)?.firstName ?? 'Someone';
        setTypingMap((prev) => ({ ...prev, [fromId]: name }));
        clearTimeout(timers[fromId]);
        timers[fromId] = setTimeout(
          () => setTypingMap((prev) => { const n = { ...prev }; delete n[fromId]; return n; }),
          3000,
        );
      } else {
        clearTimeout(timers[fromId]);
        setTypingMap((prev) => { const n = { ...prev }; delete n[fromId]; return n; });
      }
    };
    socket.on('chat:typing', onTyping);
    return () => {
      socket.off('chat:typing', onTyping);
      Object.values(timers).forEach(clearTimeout);
      setTypingMap({});
    };
  }, [conversation.id, conversation.members]);

  // Notify every other participant (a single user for 1:1, all members for a group).
  const emitTyping = (isTyping: boolean) => {
    const socket = getSocket();
    if (!socket) return;
    const recipients = conversation.isGroup
      ? conversation.members.map((mm) => mm.id)
      : otherId
        ? [otherId]
        : [];
    for (const uid of recipients) {
      socket.emit('chat:typing', { toUserId: uid, conversationId: conversation.id, isTyping });
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setText(value);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1200);
    // Detect an active @mention token right before the caret (group chats).
    if (conversation.isGroup) {
      const caret = e.target.selectionStart ?? value.length;
      const m = /(?:^|\s)@([A-Za-z0-9_.]*)$/.exec(value.slice(0, caret));
      if (m) {
        setMention({ query: m[1] ?? '', start: caret - (m[1]?.length ?? 0) - 1 });
        setMentionIndex(0);
      } else {
        setMention(null);
      }
    }
  };

  // Members matching the active @mention token (by username or name).
  const mentionQuery = mention?.query.toLowerCase() ?? '';
  const mentionCandidates =
    mention && conversation.isGroup
      ? liveConv.members
          .filter(
            (u) =>
              u.username.toLowerCase().startsWith(mentionQuery) ||
              u.firstName.toLowerCase().startsWith(mentionQuery) ||
              fullName(u).toLowerCase().includes(mentionQuery),
          )
          .slice(0, 6)
      : [];
  const activeMentionIdx = Math.min(mentionIndex, Math.max(0, mentionCandidates.length - 1));

  // Replace the active @token with the picked member's @username.
  const applyMention = (u: UserRef) => {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.start + 1 + mention.query.length);
    const insert = `@${u.username} `;
    const next = before + insert + after;
    setText(next);
    setMention(null);
    const pos = (before + insert).length;
    requestAnimationFrame(() => {
      const el = composerInput.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  // Keyboard nav for the mention popover (Enter selects instead of submitting).
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mention || mentionCandidates.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionCandidates.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      applyMention(mentionCandidates[activeMentionIdx]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const value = text;
    setText('');
    emitTyping(false);
    await send.mutateAsync(value).catch(() => setText(value));
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try {
      await sendFile.mutateAsync(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not send file');
    }
  };

  // Upload an existing audio file as a voice message (same pipeline as recording).
  const onPickAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const duration = await readAudioDuration(file);
      await sendVoice.mutateAsync({ blob: file, duration });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not send audio');
    }
  };

  // Send a photo or video as a media message.
  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await sendMedia.mutateAsync(file);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not send media');
    }
  };

  // Open a hidden picker from the attach menu, then close the menu.
  const pickFrom = (ref: React.RefObject<HTMLInputElement | null>) => {
    setAttachOpen(false);
    ref.current?.click();
  };

  // Send a one-off static location (from the composer's Current / Map tabs).
  const onSendStaticLocation = async (loc: { latitude: number; longitude: number; label?: string }) => {
    try {
      await sendLocation.mutateAsync(loc);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not share location');
    }
  };

  // Stop a live share: prefer the live store (it owns the GPS watch); fall back
  // to the API if this browser isn't the one driving it (e.g. after a reload).
  const onStopLive = (m: MessageDTO) => {
    if (liveActive?.messageId === m.id) void liveStop();
    else stopLive.mutate(m.id);
  };

  const onDeleteMessage = async (msg: MessageDTO) => {
    const ok = await confirmDialog({
      title: 'Unsend message?',
      message: 'This removes the message for everyone in the chat. This cannot be undone.',
      confirmText: 'Unsend',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteMessage.mutateAsync(msg.id);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not unsend message');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        {liveConv.isGroup ? (
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:opacity-80"
            title="Group info"
          >
            <ConversationAvatar c={liveConv} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{conversationTitle(liveConv)}</div>
              <div className="truncate text-xs text-muted-foreground">{liveConv.members.length + 1} members · Group info</div>
            </div>
          </button>
        ) : (
          <>
            <ConversationAvatar c={liveConv} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{conversationTitle(liveConv)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {liveConv.otherOnline ? 'Active now' : 'Offline'}
              </div>
            </div>
          </>
        )}
        {conversation.otherUser && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-primary"
              title={callBusy ? 'Already in a call' : `Call ${conversation.otherUser.firstName}`}
              aria-label="Start voice call"
              onClick={() => onStartCall(false)}
              disabled={callBusy}
            >
              <Phone className="size-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-primary"
              title={callBusy ? 'Already in a call' : `Video call ${conversation.otherUser.firstName}`}
              aria-label="Start video call"
              onClick={() => onStartCall(true)}
              disabled={callBusy}
            >
              <Video className="size-5" />
            </Button>
          </div>
        )}
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-primary" /></div>}
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            showSender={conversation.isGroup && !m.isOwn}
            onForward={setForwardMsg}
            onInfo={setInfoMsg}
            onDelete={onDeleteMessage}
            onStopLive={onStopLive}
          />
        ))}
        {!conversation.isGroup && lastOwn && !anyTyping && (
          <div className="flex justify-end pr-1 pt-0.5 text-[11px] text-muted-foreground">
            {lastOwnSeen ? (
              <span className="inline-flex items-center gap-0.5 text-sky-500"><CheckCheck className="size-3" /> Seen</span>
            ) : (
              <span className="inline-flex items-center gap-0.5"><Check className="size-3" /> Sent</span>
            )}
          </div>
        )}
        {anyTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-secondary px-4 py-2 text-sm text-muted-foreground">
              {conversation.isGroup
                ? `${typingNames.join(', ')} ${typingNames.length === 1 ? 'is' : 'are'} typing…`
                : 'typing…'}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {forwardMsg && (
        <ForwardDialog
          message={forwardMsg}
          currentConversationId={conversation.id}
          onClose={() => setForwardMsg(null)}
        />
      )}
      {infoMsg && (
        <MessageInfoDialog
          message={infoMsg}
          otherLastReadAt={liveConv.otherLastReadAt}
          onClose={() => setInfoMsg(null)}
        />
      )}
      {showLocation && (
        <LocationComposer
          conversationId={conversation.id}
          onSendStatic={onSendStaticLocation}
          onClose={() => setShowLocation(false)}
        />
      )}
      {showGroupInfo && liveConv.isGroup && (
        <GroupInfoDialog
          conversation={liveConv}
          onClose={() => setShowGroupInfo(false)}
          onLeft={() => onLeave?.()}
        />
      )}

      {/* composer */}
      <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
        <input ref={docInput} type="file" accept={DOC_ACCEPT} hidden onChange={onPickFile} />
        <input ref={audioInput} type="file" accept="audio/*" hidden onChange={onPickAudio} />
        <input ref={mediaInput} type="file" accept="image/*,video/*" hidden onChange={onPickMedia} />
        {!recording && (
          <>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground"
                onClick={() => setAttachOpen((v) => !v)}
                disabled={sendFile.isPending || sendMedia.isPending || sendVoice.isPending || sendLocation.isPending}
                aria-label="Attach"
                title="Attach"
              >
                {sendFile.isPending || sendMedia.isPending || sendLocation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </Button>
              {attachOpen && (
                <>
                  {/* click-away backdrop */}
                  <button
                    type="button"
                    aria-hidden
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setAttachOpen(false)}
                  />
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-52 overflow-hidden rounded-xl border bg-card py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => pickFrom(mediaInput)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-green-500/15 text-green-500">
                        <ImageIcon className="size-4" />
                      </span>
                      Photos &amp; Videos
                    </button>
                    <button
                      type="button"
                      onClick={() => pickFrom(docInput)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-indigo-500/15 text-indigo-500">
                        <Paperclip className="size-4" />
                      </span>
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => pickFrom(audioInput)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-orange-500/15 text-orange-500">
                        <FileAudio className="size-4" />
                      </span>
                      Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAttachOpen(false); setShowLocation(true); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                    >
                      <span className="grid size-8 place-items-center rounded-full bg-red-500/15 text-red-500">
                        <MapPin className="size-4" />
                      </span>
                      Location
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="relative flex-1">
              {mention && mentionCandidates.length > 0 && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border bg-card shadow-xl">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">Mention</div>
                  {mentionCandidates.map((u, i) => (
                    <button
                      key={u.id}
                      type="button"
                      // mousedown (not click) fires before the input blurs, keeping focus
                      onMouseDown={(e) => { e.preventDefault(); applyMention(u); }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                        i === activeMentionIdx && 'bg-accent',
                      )}
                    >
                      <Avatar src={u.profilePicture} name={u.firstName} initials={initials(u)} size={28} />
                      <span className="min-w-0 flex-1 truncate">{fullName(u)}</span>
                      <span className="truncate text-xs text-muted-foreground">@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
              <Input
                ref={composerInput}
                value={text}
                onChange={onChange}
                onKeyDown={onComposerKeyDown}
                placeholder="Aa"
                className="rounded-full"
                autoFocus
              />
            </div>
            <div className="relative shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label="Emoji"
                title="Emoji"
              >
                <Smile className="size-4" />
              </Button>
              {emojiOpen && (
                <EmojiPicker
                  className="bottom-full right-0 mb-2"
                  onSelect={(e) => setText((t) => t + e)}
                  onClose={() => setEmojiOpen(false)}
                />
              )}
            </div>
            {text.trim() ? (
              <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={send.isPending}>
                {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              </Button>
            ) : null}
          </>
        )}
        <VoiceRecorder
          sending={sendVoice.isPending}
          onRecordingChange={setRecording}
          onSend={(blob, duration) => sendVoice.mutate({ blob, duration })}
        />
      </form>
    </div>
  );
}

function Messenger() {
  const params = useSearchParams();
  const initialId = params.get('c');
  const { data } = useConversations();
  const [active, setActive] = React.useState<ConversationDTO | null>(null);

  // Select the conversation from ?c= once conversations load.
  React.useEffect(() => {
    if (!active && initialId && data?.conversations) {
      const found = data.conversations.find((c) => c.id === initialId);
      if (found) setActive(found);
    }
  }, [initialId, data, active]);

  return (
    <div className="container max-w-5xl py-4">
      <div className="grid h-[calc(100vh-7rem)] grid-cols-1 overflow-hidden rounded-xl border bg-card sm:grid-cols-[320px_1fr]">
        <div className="min-h-0 border-r">
          <ConversationList activeId={active?.id ?? null} onSelect={setActive} />
        </div>
        <div className="hidden min-h-0 sm:block">
          {active ? (
            <ChatThread conversation={active} onLeave={() => setActive(null)} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a chat to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <TopNav />
        <React.Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="size-7 animate-spin text-primary" /></div>}>
          <Messenger />
        </React.Suspense>
      </div>
    </AuthGuard>
  );
}
