'use client';

import * as React from 'react';
import { BarChart3, Clock, Loader2, Images, Paperclip, Plus, Smile, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useCreatePost } from '@/hooks/use-posts';
import { useFriends } from '@/hooks/use-friends';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DOC_ACCEPT } from '@/components/ui/file-attachment';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn, formatBytes, initials } from '@/lib/utils';

const BACKGROUNDS = ['', '#1877F2', '#E9710F', '#21A35E', '#9333EA', '#DB2777', '#0F172A'];
const MAX_IMAGES = 10;
const MAX_POLL_OPTIONS = 8;
const POLL_DURATIONS: Array<{ label: string; days: number | null }> = [
  { label: 'Never expires', days: null },
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
];

export function Composer() {
  const user = useAuthStore((s) => s.user)!;
  const create = useCreatePost();
  const [content, setContent] = React.useState('');
  const [bg, setBg] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const docInput = React.useRef<HTMLInputElement>(null);

  // Poll composition state (mutually exclusive with photo/background).
  const [pollMode, setPollMode] = React.useState(false);
  const [pollQuestion, setPollQuestion] = React.useState('');
  const [pollOptions, setPollOptions] = React.useState<string[]>(['', '']);
  const [pollMultiple, setPollMultiple] = React.useState(false);
  const [pollDays, setPollDays] = React.useState<number | null>(null);

  // Tag people + schedule
  const [taggedIds, setTaggedIds] = React.useState<string[]>([]);
  const [showTag, setShowTag] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [showSchedule, setShowSchedule] = React.useState(false);
  // Audience: who can see this post.
  const [privacy, setPrivacy] = React.useState<'PUBLIC' | 'FRIENDS' | 'ONLY_ME'>('PUBLIC');
  const friends = useFriends();

  // Object URLs for local previews; revoked when the file set changes.
  const previews = React.useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  React.useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const reset = () => {
    setContent('');
    setBg('');
    setFiles([]);
    setOpen(false);
    setEmojiOpen(false);
    setPollMode(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollMultiple(false);
    setPollDays(null);
    setTaggedIds([]);
    setShowTag(false);
    setScheduledFor('');
    setShowSchedule(false);
    setPrivacy('PUBLIC');
  };

  const startPoll = () => {
    // Polls can't carry images or a background.
    setFiles([]);
    setBg('');
    setPollMode(true);
    setOpen(true);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) {
      setPollMode(false); // photos and polls are mutually exclusive
      setFiles((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
      setOpen(true);
    }
    e.target.value = ''; // allow re-picking the same file
  };

  // Documents share the attachment list with photos/videos (all sent as `images`).
  const onPickDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) {
      setPollMode(false);
      setFiles((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
      setOpen(true);
    }
    e.target.value = '';
  };

  const isMediaFile = (f: File) => f.type.startsWith('image/') || f.type.startsWith('video/');

  const setOption = (i: number, val: string) =>
    setPollOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const addOption = () =>
    setPollOptions((prev) => (prev.length < MAX_POLL_OPTIONS ? [...prev, ''] : prev));
  const removeOption = (i: number) =>
    setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const trimmedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = pollQuestion.trim().length > 0 && trimmedOptions.length >= 2;

  const scheduledISO = scheduledFor ? new Date(scheduledFor).toISOString() : '';
  const isScheduled = !!scheduledISO && new Date(scheduledFor).getTime() > Date.now();

  const submit = async () => {
    if (pollMode && !pollValid) return;
    if (!pollMode && !content.trim() && files.length === 0) return;
    const extras = {
      ...(taggedIds.length ? { taggedUserIds: taggedIds } : {}),
      ...(isScheduled ? { scheduledFor: scheduledISO } : {}),
    };
    try {
      if (pollMode) {
        await create.mutateAsync({
          content,
          privacy,
          poll: {
            question: pollQuestion.trim(),
            options: trimmedOptions,
            allowMultiple: pollMultiple,
            ...(pollDays ? { durationDays: pollDays } : {}),
          },
          ...extras,
        });
      } else if (files.length > 0) {
        const fd = new FormData();
        fd.append('content', content);
        fd.append('privacy', privacy);
        if (bg) fd.append('backgroundColor', bg);
        files.forEach((f) => fd.append('images', f));
        if (taggedIds.length) fd.append('taggedUserIds', taggedIds.join(','));
        if (isScheduled) fd.append('scheduledFor', scheduledISO);
        await create.mutateAsync(fd);
      } else {
        await create.mutateAsync({ content, privacy, ...(bg ? { backgroundColor: bg } : {}), ...extras });
      }
      reset();
      toast.success(isScheduled ? 'Post scheduled!' : pollMode ? 'Poll posted!' : 'Posted!');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not post');
    }
  };

  const toggleTag = (id: string) =>
    setTaggedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canPost =
    !create.isPending && (pollMode ? pollValid : content.trim().length > 0 || files.length > 0);

  return (
    <Card className="p-4">
      <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={onPick} />
      <input ref={docInput} type="file" accept={DOC_ACCEPT} multiple hidden onChange={onPickDocs} />

      <div className="flex items-start gap-3">
        <Avatar src={user.profilePicture} name={user.firstName} initials={initials(user)} />
        <div className="flex-1">
          {open ? (
            <Textarea
              autoFocus
              placeholder={pollMode ? 'Say something about your poll… (optional)' : `What's on your mind, ${user.firstName}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={cn(
                'min-h-[80px] resize-none border-0 text-base focus-visible:ring-0',
                bg && !files.length && !pollMode && 'rounded-md text-center text-xl font-semibold text-white placeholder:text-white/70',
              )}
              style={bg && !files.length && !pollMode ? { background: bg, paddingTop: 28 } : undefined}
            />
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="h-10 w-full rounded-full bg-muted px-4 text-left text-muted-foreground hover:bg-accent"
            >
              What&apos;s on your mind, {user.firstName}?
            </button>
          )}
        </div>
      </div>

      {/* poll editor */}
      {pollMode && (
        <div className="mt-3 animate-scale-in overflow-hidden rounded-2xl border bg-gradient-to-b from-primary/[0.06] to-transparent">
          <div className="flex items-center justify-between border-b bg-primary/[0.06] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-primary">
                <BarChart3 className="size-3.5" />
              </span>
              Create a poll
            </span>
            <button
              onClick={() => setPollMode(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              aria-label="Remove poll"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2.5 p-3.5">
            <Input
              placeholder="Ask a question…"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              maxLength={300}
              className="font-medium"
            />
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    maxLength={120}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <button
                onClick={addOption}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <Plus className="size-4" /> Add option
              </button>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-2.5">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={pollMultiple}
                  onChange={(e) => setPollMultiple(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Allow multiple answers
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Duration
                <select
                  value={pollDays === null ? '' : String(pollDays)}
                  onChange={(e) => setPollDays(e.target.value === '' ? null : Number(e.target.value))}
                  className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                >
                  {POLL_DURATIONS.map((d) => (
                    <option key={d.label} value={d.days === null ? '' : String(d.days)}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* image/video previews */}
      {files.some((f) => isMediaFile(f)) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {files.map((f, i) =>
            isMediaFile(f) ? (
              <div key={previews[i]} className="relative aspect-square overflow-hidden rounded-md border">
                {f.type.startsWith('video/') ? (
                  <video src={previews[i]} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* document attachments */}
      {files.some((f) => !isMediaFile(f)) && (
        <div className="mt-3 space-y-2">
          {files.map((f, i) =>
            !isMediaFile(f) ? (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-primary">
                  <Paperclip className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                </span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null,
          )}
        </div>
      )}

      {open && (
        <>
          {!files.length && !pollMode && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Background:</span>
              {BACKGROUNDS.map((c) => (
                <button
                  key={c || 'none'}
                  onClick={() => setBg(c)}
                  className={cn('size-7 rounded-md border', bg === c && 'ring-2 ring-primary ring-offset-1')}
                  style={{ background: c || 'transparent' }}
                  aria-label={c || 'no background'}
                  title={c || 'No background'}
                >
                  {!c && <span className="text-xs text-muted-foreground">∅</span>}
                </button>
              ))}
            </div>
          )}
          {/* schedule picker */}
          {showSchedule && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <Clock className="size-4 text-rose-500" />
              <span className="text-muted-foreground">Publish at:</span>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="rounded-md border border-input bg-card px-2 py-1 text-sm"
              />
              {scheduledFor && !isScheduled && <span className="text-xs text-destructive">Pick a future time</span>}
              {scheduledFor && (
                <button onClick={() => setScheduledFor('')} className="text-xs text-muted-foreground hover:underline">
                  Clear
                </button>
              )}
            </div>
          )}

          {/* tag people */}
          {showTag && (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 text-sm font-medium">Tag friends</div>
              {friends.data?.friends.length ? (
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                  {friends.data.friends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleTag(f.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm',
                        taggedIds.includes(f.id) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent',
                      )}
                    >
                      <Avatar src={f.profilePicture} name={f.firstName} initials={`${f.firstName[0] ?? ''}${f.lastName[0] ?? ''}`} size={20} />
                      {f.firstName} {f.lastName}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Add friends to tag them in posts.</p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex items-center gap-1 text-sm hover:text-foreground"
              >
                <Images className="size-4 text-green-600" /> Photo
              </button>
              <button
                type="button"
                onClick={() => docInput.current?.click()}
                className="flex items-center gap-1 text-sm hover:text-foreground"
              >
                <Paperclip className="size-4 text-sky-600" /> File
              </button>
              <button
                type="button"
                onClick={() => (pollMode ? setPollMode(false) : startPoll())}
                className={cn('flex items-center gap-1 text-sm hover:text-foreground', pollMode && 'text-primary')}
              >
                <BarChart3 className="size-4 text-amber-600" /> Poll
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  className={cn('flex items-center gap-1 text-sm hover:text-foreground', emojiOpen && 'text-primary')}
                >
                  <Smile className="size-4 text-yellow-500" /> Emoji
                </button>
                {emojiOpen && (
                  <EmojiPicker
                    className="bottom-full left-0 mb-2"
                    onSelect={(e) => setContent((c) => c + e)}
                    onClose={() => setEmojiOpen(false)}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowTag((v) => !v)}
                className={cn('flex items-center gap-1 text-sm hover:text-foreground', (showTag || taggedIds.length > 0) && 'text-primary')}
              >
                <UserPlus className="size-4 text-blue-500" /> Tag
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                className={cn('flex items-center gap-1 text-sm hover:text-foreground', (showSchedule || isScheduled) && 'text-primary')}
              >
                <Clock className="size-4 text-rose-500" /> Schedule
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                className="rounded-md border bg-background px-2 py-1 text-xs"
                title="Who can see this post?"
                aria-label="Post audience"
              >
                <option value="PUBLIC">🌐 Public</option>
                <option value="FRIENDS">👥 Friends</option>
                <option value="ONLY_ME">🔒 Only me</option>
              </select>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={!canPost}>
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                {isScheduled ? 'Schedule' : 'Post'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* When collapsed, still expose quick shortcuts */}
      {!open && (
        <div className="mt-3 flex justify-around border-t pt-2 text-sm font-medium text-muted-foreground">
          <button onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent">
            <Images className="size-5 text-green-600" /> Photo/Video
          </button>
          <button onClick={() => docInput.current?.click()} className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent">
            <Paperclip className="size-5 text-sky-600" /> File
          </button>
          <button onClick={startPoll} className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent">
            <BarChart3 className="size-5 text-amber-600" /> Poll
          </button>
          <button onClick={() => { setOpen(true); setEmojiOpen(true); }} className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-accent">
            <Smile className="size-5 text-yellow-500" /> Emoji
          </button>
        </div>
      )}
    </Card>
  );
}
