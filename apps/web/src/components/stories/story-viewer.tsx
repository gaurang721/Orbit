'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { StoryGroupDTO } from '@fbclone/types';
import { useAuthStore } from '@/stores/auth-store';
import { confirmDialog } from '@/stores/confirm-store';
import { useDeleteStory, useReactStory, useStoryViewers, useViewStory } from '@/hooks/use-stories';
import { Avatar } from '@/components/ui/avatar';
import { cn, fullName, initials, timeAgo } from '@/lib/utils';

const QUICK = ['👍', '❤️', '😆', '😮', '😢', '😡'];
const DURATION = 5000;

interface Props {
  groups: StoryGroupDTO[];
  startGroup: number;
  onClose: () => void;
}

export function StoryViewer({ groups, startGroup, onClose }: Props) {
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const view = useViewStory();
  const react = useReactStory();
  const del = useDeleteStory();
  const [gi, setGi] = React.useState(startGroup);
  const [si, setSi] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [showViewers, setShowViewers] = React.useState(false);

  const group = groups[gi];
  const story = group?.stories[si];
  const viewers = useStoryViewers(showViewers && story ? story.id : null);

  const close = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['stories'] });
    onClose();
  }, [qc, onClose]);

  const next = React.useCallback(() => {
    setShowViewers(false);
    if (!group) return close();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else close();
  }, [group, si, gi, groups.length, close]);

  const prev = React.useCallback(() => {
    setShowViewers(false);
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { const pg = gi - 1; setGi(pg); setSi(groups[pg]!.stories.length - 1); }
  }, [si, gi, groups]);

  // record a view + run the auto-advance progress timer for the current story
  React.useEffect(() => {
    if (!story) return;
    if (story.author.id !== me.id) view.mutate(story.id);
    setProgress(0);
    if (showViewers) return; // pause while viewing the audience list
    const step = 50;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(id);
          next();
          return 100;
        }
        return p + (100 * step) / DURATION;
      });
    }, step);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, si, showViewers]);

  if (!group || !story) return null;
  const isOwn = story.author.id === me.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in">
      <button onClick={close} className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="size-6" />
      </button>

      <div className="relative flex h-[92vh] w-full max-w-[420px] flex-col overflow-hidden rounded-xl bg-black">
        {/* progress bars */}
        <div className="absolute left-0 right-0 top-0 z-30 flex gap-1 p-2">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full bg-white" style={{ width: `${i < si ? 100 : i === si ? progress : 0}%` }} />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute left-0 right-0 top-4 z-30 flex items-center gap-2 px-3 pt-2 text-white">
          <Avatar src={story.author.profilePicture} name={story.author.firstName} initials={initials(story.author)} size={36} />
          <div className="flex-1">
            <div className="text-sm font-semibold">{fullName(story.author)}</div>
            <div className="text-xs text-white/70">{timeAgo(story.createdAt)}</div>
          </div>
          {isOwn && (
            <button
              onClick={async () => {
                const id = story.id;
                const ok = await confirmDialog({
                  title: 'Delete story?',
                  message: 'This story will be permanently removed.',
                  confirmText: 'Delete',
                  destructive: true,
                });
                if (ok) del.mutate(id, { onSuccess: () => { toast.success('Story deleted'); next(); } });
              }}
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        {/* tap zones */}
        <button className="absolute bottom-0 left-0 top-0 z-20 w-1/3" onClick={prev} aria-label="Previous" />
        <button className="absolute bottom-0 right-0 top-0 z-20 w-1/3" onClick={next} aria-label="Next" />

        {/* body */}
        {story.type === 'TEXT' || !story.mediaUrl ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-2xl font-semibold text-white" style={{ background: story.backgroundColor ?? '#1877F2' }}>
            {story.caption}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={story.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
            {story.caption && (
              <div className="absolute bottom-20 left-0 right-0 px-4 text-center text-lg font-medium text-white drop-shadow-lg">
                {story.caption}
              </div>
            )}
          </div>
        )}

        {/* footer: own → views; others → reactions */}
        <div className="absolute bottom-0 left-0 right-0 z-30 p-3">
          {isOwn ? (
            <button onClick={() => setShowViewers((v) => !v)} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
              <Eye className="size-4" /> {story.viewCount} view{story.viewCount === 1 ? '' : 's'}
            </button>
          ) : (
            <div className="flex justify-center gap-2 rounded-full bg-white/10 px-3 py-2">
              {QUICK.map((e) => (
                <button
                  key={e}
                  onClick={() => { react.mutate({ storyId: story.id, emoji: e }); toast.success(`Reacted ${e}`); }}
                  className="text-2xl transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          {isOwn && showViewers && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-black/80 p-2">
              {(viewers.data?.viewers.length ?? 0) === 0 && <p className="p-2 text-center text-sm text-white/60">No views yet</p>}
              {viewers.data?.viewers.map((v) => (
                <div key={v.user.id} className="flex items-center gap-2 p-1 text-white">
                  <Avatar src={v.user.profilePicture} name={v.user.firstName} initials={initials(v.user)} size={28} />
                  <span className="flex-1 text-sm">{fullName(v.user)}</span>
                  {v.emoji && <span>{v.emoji}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
