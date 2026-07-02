'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, Bookmark, Check, Globe, Loader2, Lock, MessageCircle, MoreHorizontal, Pencil, Share2, Smile, ThumbsUp, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { REACTION_META, type CommentDTO, type PollDTO, type PostDTO, type SharedPostDTO, type ReactionType } from '@fbclone/types';
import { ApiClientError } from '@/lib/api-client';
import { confirmDialog } from '@/stores/confirm-store';
import { useAddComment, useComments, useDeleteComment, useDeletePost, useReactToComment, useReactToPost, useSavePost, useSharePost, useUpdateComment, useUpdatePost, useVotePoll } from '@/hooks/use-posts';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RichText } from '@/components/ui/rich-text';
import { Textarea } from '@/components/ui/textarea';
import { VideoPlayer } from '@/components/ui/video-player';
import { FileAttachment } from '@/components/ui/file-attachment';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

const REACTION_ORDER: ReactionType[] = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];

export function PostCard({ post }: { post: PostDTO }) {
  const react = useReactToPost();
  const del = useDeletePost();
  const savePost = useSavePost();
  const update = useUpdatePost();
  const [showComments, setShowComments] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(post.content ?? '');
  const [draftPrivacy, setDraftPrivacy] = React.useState<'PUBLIC' | 'FRIENDS' | 'ONLY_ME'>(
    post.privacy === 'FRIENDS' ? 'FRIENDS' : post.privacy === 'ONLY_ME' ? 'ONLY_ME' : 'PUBLIC',
  );

  const mine = post.reactions.mine;
  const topReactions = REACTION_ORDER.filter((t) => (post.reactions.counts[t] ?? 0) > 0).slice(0, 3);

  const setReaction = (type: ReactionType) => {
    react.mutate({ postId: post.id, type: mine === type ? null : type });
  };

  const startEdit = () => {
    setDraft(post.content ?? '');
    setDraftPrivacy(post.privacy === 'FRIENDS' ? 'FRIENDS' : post.privacy === 'ONLY_ME' ? 'ONLY_ME' : 'PUBLIC');
    setEditing(true);
    setMenuOpen(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(post.content ?? '');
  };

  // A post needs *something* to show after the edit: text, media, or a background.
  const canSaveEdit = draft.trim().length > 0 || post.media.length > 0 || !!post.backgroundColor;

  // Split attachments: images/videos render in a grid; documents as file cards.
  const visualMedia = post.media.filter((m) => m.type !== 'FILE');
  const fileMedia = post.media.filter((m) => m.type === 'FILE');

  const saveEdit = async () => {
    const content = draft.trim();
    const contentChanged = content !== (post.content ?? '').trim();
    const privacyChanged = draftPrivacy !== post.privacy;
    if (!contentChanged && !privacyChanged) {
      setEditing(false); // nothing changed
      return;
    }
    try {
      await update.mutateAsync({
        postId: post.id,
        ...(contentChanged ? { content } : {}),
        ...(privacyChanged ? { privacy: draftPrivacy } : {}),
      });
      setEditing(false);
      toast.success('Post updated');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update post');
    }
  };

  const onDelete = async () => {
    setMenuOpen(false);
    const ok = await confirmDialog({
      title: 'Delete post?',
      message: 'This permanently removes the post and its comments. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(post.id);
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not delete');
    }
  };

  return (
    <Card className="card-hover overflow-visible">
      {/* header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center gap-3">
          <Link href={`/u/${post.author.username}`}>
            <Avatar src={post.author.profilePicture} name={post.author.firstName} initials={initials(post.author)} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-1 font-semibold">
              <Link href={`/u/${post.author.username}`} className="flex items-center gap-1 hover:underline">
                {fullName(post.author)}
                {post.author.verified && <span title="Verified" className="text-primary">✔</span>}
              </Link>
              {post.taggedUsers.length > 0 && (
                <span className="font-normal text-muted-foreground">
                  {' '}is with{' '}
                  {post.taggedUsers.map((u, i) => (
                    <React.Fragment key={u.id}>
                      {i > 0 && (i === post.taggedUsers.length - 1 ? ' and ' : ', ')}
                      <Link href={`/u/${u.username}`} className="font-semibold text-foreground hover:underline">
                        {fullName(u)}
                      </Link>
                    </React.Fragment>
                  ))}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              @{post.author.username} ·{' '}
              {post.scheduledFor ? (
                <span className="text-rose-500" title="Scheduled">⏰ Scheduled for {new Date(post.scheduledFor).toLocaleString()}</span>
              ) : (
                <Link href={`/post/${post.id}`} className="hover:underline" title="View post">
                  {timeAgo(post.createdAt)}
                </Link>
              )}
              {post.feeling ? ` · feeling ${post.feeling}` : ''}
              {post.editedAt && (
                <span title={`Edited ${timeAgo(post.editedAt)}`}> · Edited</span>
              )}
              {' · '}
              {post.privacy === 'ONLY_ME' ? (
                <Lock className="inline size-3 align-[-1px]" aria-label="Only me" />
              ) : post.privacy === 'FRIENDS' ? (
                <Users className="inline size-3 align-[-1px]" aria-label="Friends" />
              ) : (
                <Globe className="inline size-3 align-[-1px]" aria-label="Public" />
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen((v) => !v)}>
            <MoreHorizontal className="size-5" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 origin-top-right animate-scale-in rounded-xl border bg-card py-1 shadow-2xl">
                <button
                  onClick={() => { savePost.mutate({ postId: post.id, save: true }); setMenuOpen(false); toast.success('Saved to your items'); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Bookmark className="size-4" /> Save post
                </button>
                {post.isOwn && (
                  <button
                    onClick={startEdit}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Pencil className="size-4" /> Edit post
                  </button>
                )}
                {post.isOwn && (
                  <button
                    onClick={onDelete}
                    disabled={del.isPending}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                  >
                    <Trash2 className="size-4" /> Delete post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* body */}
      {editing ? (
        <div className="space-y-2 px-4 pb-3">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's on your mind?"
            className="min-h-[90px] resize-none text-[15px]"
          />
          <div className="flex items-center justify-end gap-2">
            <select
              value={draftPrivacy}
              onChange={(e) => setDraftPrivacy(e.target.value as typeof draftPrivacy)}
              className="mr-auto rounded-md border bg-background px-2 py-1 text-xs"
              aria-label="Post audience"
              title="Who can see this post?"
            >
              <option value="PUBLIC">🌐 Public</option>
              <option value="FRIENDS">👥 Friends</option>
              <option value="ONLY_ME">🔒 Only me</option>
            </select>
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={update.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={update.isPending || !canSaveEdit}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      ) : post.backgroundColor && post.media.length === 0 ? (
        <div
          className="mx-4 mb-2 flex min-h-[180px] items-center justify-center rounded-md px-6 text-center text-2xl font-semibold text-white"
          style={{ background: post.backgroundColor }}
        >
          {post.content && <RichText text={post.content} />}
        </div>
      ) : (
        post.content && (
          <p className="whitespace-pre-wrap px-4 pb-2 text-[15px]">
            <RichText text={post.content} />
          </p>
        )
      )}

      {/* shared (reposted) original */}
      {post.sharedPost ? (
        <SharedPostEmbed shared={post.sharedPost} />
      ) : post.type === 'SHARE' ? (
        <div className="mx-4 mb-2 rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          This content isn&apos;t available right now.
        </div>
      ) : null}

      {/* poll */}
      {post.poll && <PollBlock postId={post.id} poll={post.poll} />}

      {/* image/video attachments */}
      {visualMedia.length > 0 && (
        <div
          className={cn(
            'grid gap-0.5',
            visualMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {visualMedia.map((m) =>
            m.type === 'VIDEO' ? (
              <VideoPlayer
                key={m.id}
                src={m.url}
                className={cn(visualMedia.length === 1 ? 'max-h-[520px]' : 'aspect-square object-cover')}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url}
                alt=""
                className={cn('w-full object-cover', visualMedia.length === 1 ? 'max-h-[520px]' : 'aspect-square')}
                loading="lazy"
              />
            ),
          )}
        </div>
      )}

      {/* document attachments */}
      {fileMedia.length > 0 && (
        <div className="space-y-2 px-4 pb-2">
          {fileMedia.map((m) => (
            <FileAttachment key={m.id} url={m.url} fileName={m.fileName} size={m.size} mimeType={m.mimeType} />
          ))}
        </div>
      )}

      {/* counts */}
      <div className="flex items-center justify-between px-4 py-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          {topReactions.map((t) => (
            <span key={t}>{REACTION_META[t].emoji}</span>
          ))}
          {post.reactions.total > 0 && <span>{post.reactions.total}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowComments((v) => !v)} className="hover:underline">
            {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </button>
          {post.shareCount > 0 && (
            <span>{post.shareCount} share{post.shareCount === 1 ? '' : 's'}</span>
          )}
        </div>
      </div>

      {/* action bar */}
      <div className="grid grid-cols-3 border-t text-sm font-semibold text-muted-foreground">
        <div className="group relative">
          <button
            onClick={() => setReaction(mine ?? 'LIKE')}
            className={cn(
              'flex w-full items-center justify-center gap-2 py-2 hover:bg-accent',
              mine && 'font-bold',
            )}
            style={mine ? { color: REACTION_META[mine].color } : undefined}
          >
            {mine ? (
              <>
                <span className="text-lg leading-none">{REACTION_META[mine].emoji}</span>
                {REACTION_META[mine].label}
              </>
            ) : (
              <>
                <ThumbsUp className="size-4" /> Like
              </>
            )}
          </button>
          {/* Hover reaction palette. `bottom-full` anchors it to the button's
              top edge and the transparent `pb-2` bridges the gap, so the cursor
              stays inside the hover zone while traveling up to the emojis —
              otherwise the palette vanishes before you can click one. */}
          <div className="pointer-events-none absolute bottom-full left-2 z-10 translate-y-1 scale-90 pb-2 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1 shadow-2xl">
              {REACTION_ORDER.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setReaction(t)}
                  title={REACTION_META[t].label}
                  style={{ transitionDelay: `${i * 25}ms` }}
                  className="text-2xl transition-transform duration-150 hover:-translate-y-1.5 hover:scale-150"
                >
                  {REACTION_META[t].emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center justify-center gap-2 py-2 hover:bg-accent">
          <MessageCircle className="size-4" /> Comment
        </button>
        <button
          className="flex items-center justify-center gap-2 py-2 hover:bg-accent"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="size-4" /> Share
        </button>
      </div>

      {showComments && <CommentsSection postId={post.id} />}
      {shareOpen && <ShareDialog post={post} onClose={() => setShareOpen(false)} />}
    </Card>
  );
}

/** The original post embedded inside a SHARE, rendered read-only. */
function SharedPostEmbed({ shared }: { shared: SharedPostDTO }) {
  const visual = shared.media.filter((m) => m.type !== 'FILE');
  const files = shared.media.filter((m) => m.type === 'FILE');
  return (
    <div className="mx-4 mb-2 overflow-hidden rounded-xl border">
      <Link href={`/post/${shared.id}`} className="flex items-center gap-2 p-3 pb-2 hover:underline">
        <Avatar src={shared.author.profilePicture} name={shared.author.firstName} initials={initials(shared.author)} size={32} />
        <div className="leading-tight">
          <div className="text-sm font-semibold">{fullName(shared.author)}</div>
          <div className="text-xs text-muted-foreground">{timeAgo(shared.createdAt)}</div>
        </div>
      </Link>

      {shared.backgroundColor && visual.length === 0 ? (
        <div
          className="mx-3 mb-3 flex min-h-[120px] items-center justify-center rounded-md px-6 text-center text-lg font-semibold text-white"
          style={{ background: shared.backgroundColor }}
        >
          {shared.content && <RichText text={shared.content} />}
        </div>
      ) : (
        shared.content && (
          <p className="whitespace-pre-wrap px-3 pb-2 text-sm">
            <RichText text={shared.content} />
          </p>
        )
      )}

      {visual.length > 0 && (
        <div className={cn('grid gap-0.5', visual.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
          {visual.map((m) =>
            m.type === 'VIDEO' ? (
              <VideoPlayer key={m.id} src={m.url} className={cn(visual.length === 1 ? 'max-h-80' : 'aspect-square object-cover')} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className={cn('w-full object-cover', visual.length === 1 ? 'max-h-80' : 'aspect-square')} loading="lazy" />
            ),
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 p-3 pt-2">
          {files.map((m) => (
            <FileAttachment key={m.id} url={m.url} fileName={m.fileName} size={m.size} mimeType={m.mimeType} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Modal to repost a post to your feed with an optional caption + privacy. */
function ShareDialog({ post, onClose }: { post: PostDTO; onClose: () => void }) {
  const share = useSharePost();
  const [caption, setCaption] = React.useState('');
  const [privacy, setPrivacy] = React.useState<'PUBLIC' | 'FRIENDS' | 'ONLY_ME'>('PUBLIC');
  // When resharing a share, we repost the original author's post.
  const original = post.type === 'SHARE' && post.sharedPost ? post.sharedPost.author : post.author;

  const submit = async () => {
    try {
      await share.mutateAsync({ postId: post.id, content: caption, privacy });
      toast.success('Shared to your feed');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not share');
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Post link copied to clipboard');
    } catch {
      toast.message(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Share post</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-accent" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <Textarea
          autoFocus
          placeholder={`Say something about ${original.firstName}'s post…`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="min-h-[80px] resize-none"
        />
        <p className="mt-2 text-xs text-muted-foreground">Reposting {fullName(original)}&apos;s post to your feed.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as 'PUBLIC' | 'FRIENDS' | 'ONLY_ME')}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          >
            <option value="PUBLIC">Public</option>
            <option value="FRIENDS">Friends</option>
            <option value="ONLY_ME">Only me</option>
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copyLink}>Copy link</Button>
            <Button size="sm" onClick={submit} disabled={share.isPending}>
              {share.isPending && <Loader2 className="size-4 animate-spin" />} Share now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Relative "time until" the poll closes (timeAgo only formats past times). */
function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'closed';
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'closes in <1h';
  if (h < 24) return `closes in ${h}h`;
  return `closes in ${Math.floor(h / 24)}d`;
}

function PollBlock({ postId, poll }: { postId: string; poll: PollDTO }) {
  const vote = useVotePoll();
  const selected = poll.options.filter((o) => o.votedByMe).map((o) => o.id);
  const hasVoted = selected.length > 0;
  // highest vote count, used to subtly crown the leading option once voting starts
  const leading = poll.options.reduce((max, o) => Math.max(max, o.voteCount), 0);

  const choose = (optionId: string) => {
    if (poll.closed || vote.isPending) return;
    let next: string[];
    if (poll.allowMultiple) {
      next = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
    } else {
      // single-choice: clicking your current pick clears it, else switches to it
      next = selected.includes(optionId) ? [] : [optionId];
    }
    vote.mutate({ postId, optionIds: next });
  };

  return (
    <div className="mx-4 mb-3 animate-fade-in overflow-hidden rounded-2xl border bg-gradient-to-b from-primary/[0.05] to-transparent">
      {/* header */}
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <BarChart3 className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-snug">{poll.question}</div>
          <div className="text-xs text-muted-foreground">
            {poll.allowMultiple ? 'Select one or more' : 'Select one'}
          </div>
        </div>
      </div>

      {/* options */}
      <div className="space-y-2 p-3.5 pt-3">
        {poll.options.map((o) => {
          const pct = poll.totalVotes > 0 ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0;
          const isLeading = hasVoted && o.voteCount > 0 && o.voteCount === leading;
          return (
            <button
              key={o.id}
              type="button"
              disabled={poll.closed || vote.isPending}
              onClick={() => choose(o.id)}
              className={cn(
                'group relative block w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all',
                o.votedByMe ? 'border-primary/70 ring-1 ring-primary/40' : 'border-border',
                !poll.closed && 'hover:border-primary/50 hover:shadow-sm active:scale-[0.99]',
                poll.closed && 'cursor-default',
              )}
            >
              {/* animated fill bar (only after the first vote) */}
              <span
                className={cn(
                  'absolute inset-y-0 left-0 transition-[width] duration-500 ease-out',
                  isLeading ? 'bg-gradient-to-r from-primary/30 to-primary/15' : 'bg-primary/10',
                )}
                style={{ width: hasVoted ? `${pct}%` : '0%' }}
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                      o.votedByMe
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/40 group-hover:border-primary/60',
                    )}
                  >
                    {o.votedByMe && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className={cn('truncate', (o.votedByMe || isLeading) && 'font-semibold')}>
                    {o.text}
                  </span>
                </span>
                {hasVoted && (
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                    <span className={cn('text-sm font-bold', isLeading ? 'text-primary' : 'text-foreground')}>
                      {pct}%
                    </span>
                    <span className="text-xs text-muted-foreground">({o.voteCount})</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3.5 text-xs text-muted-foreground">
        <span className="font-medium">
          {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
            poll.closed
              ? 'bg-muted text-muted-foreground'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          )}
        >
          {poll.closed ? (
            <>
              <Lock className="size-3" /> Final results
            </>
          ) : poll.expiresAt ? (
            timeUntil(poll.expiresAt)
          ) : (
            'Open'
          )}
        </span>
      </div>
    </div>
  );
}

function CommentsSection({ postId }: { postId: string }) {
  const { data, isLoading } = useComments(postId, true);
  const add = useAddComment(postId);
  const me = useAuthStore((s) => s.user)!;
  const [text, setText] = React.useState('');
  const [emojiOpen, setEmojiOpen] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const value = text;
    setText('');
    try {
      await add.mutateAsync(value);
    } catch (err) {
      setText(value);
      toast.error(err instanceof ApiClientError ? err.message : 'Could not comment');
    }
  };

  return (
    <div className="space-y-3 border-t p-4">
      <form onSubmit={submit} className="flex items-center gap-2">
        <Avatar src={me.profilePicture} name={me.firstName} initials={initials(me)} size={32} />
        <Input placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} className="rounded-full" />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className={cn('flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent', emojiOpen && 'text-primary')}
            aria-label="Emoji"
            title="Emoji"
          >
            <Smile className="size-4" />
          </button>
          {emojiOpen && (
            <EmojiPicker
              className="bottom-full right-0 mb-2"
              onSelect={(e) => setText((t) => t + e)}
              onClose={() => setEmojiOpen(false)}
            />
          )}
        </div>
        <Button type="submit" size="sm" disabled={add.isPending || !text.trim()}>
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Send'}
        </Button>
      </form>

      {isLoading && <Loader2 className="size-5 animate-spin text-primary" />}
      {data?.comments.map((c) => (
        <CommentItem key={c.id} postId={postId} c={c} />
      ))}
    </div>
  );
}

function CommentItem({ postId, c }: { postId: string; c: CommentDTO }) {
  const react = useReactToComment(postId);
  const update = useUpdateComment(postId);
  const remove = useDeleteComment(postId);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.content);
  const liked = c.myReaction != null;

  const saveEdit = async () => {
    const content = draft.trim();
    if (!content || content === c.content) return setEditing(false);
    try {
      await update.mutateAsync({ commentId: c.id, content });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not edit comment');
    }
  };

  const onDelete = async () => {
    const ok = await confirmDialog({
      title: 'Delete comment?',
      message: 'This permanently removes the comment. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) remove.mutate(c.id);
  };

  return (
    <div className="flex items-start gap-2">
      <Avatar src={c.author.profilePicture} name={c.author.firstName} initials={initials(c.author)} size={32} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(c.content); } }}
              className="rounded-full"
            />
            <Button size="sm" onClick={saveEdit} disabled={update.isPending}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(c.content); }}>Cancel</Button>
          </div>
        ) : (
          <>
            <div className="inline-block rounded-2xl bg-muted px-3 py-2">
              <div className="text-sm font-semibold">{fullName(c.author)}</div>
              <RichText text={c.content} className="text-sm" />
            </div>
            <div className="mt-0.5 flex items-center gap-3 px-2 text-[11px] text-muted-foreground">
              <button
                onClick={() => react.mutate({ commentId: c.id, type: liked ? null : 'LIKE' })}
                className={cn('font-semibold hover:underline', liked && 'text-primary')}
              >
                Like
              </button>
              {c.reactionCount > 0 && <span className="inline-flex items-center gap-0.5">👍 {c.reactionCount}</span>}
              <span>
                {timeAgo(c.createdAt)}
                {c.editedAt && ' · Edited'}
              </span>
              {c.isOwn && (
                <button onClick={() => { setDraft(c.content); setEditing(true); }} className="hover:underline">
                  Edit
                </button>
              )}
              {c.isOwn && (
                <button onClick={onDelete} className="text-destructive hover:underline">
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
