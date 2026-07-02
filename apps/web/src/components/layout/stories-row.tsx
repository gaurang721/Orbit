'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { useStories } from '@/hooks/use-stories';
import { useAuthStore } from '@/stores/auth-store';
import { CreateStoryDialog } from '@/components/stories/create-story-dialog';
import { StoryViewer } from '@/components/stories/story-viewer';
import { Avatar } from '@/components/ui/avatar';
import { cn, initials } from '@/lib/utils';

export function StoriesRow() {
  const me = useAuthStore((s) => s.user)!;
  const { data } = useStories();
  const groups = data?.groups ?? [];
  const [creating, setCreating] = React.useState(false);
  const [viewerStart, setViewerStart] = React.useState<number | null>(null);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* create story */}
        <button
          onClick={() => setCreating(true)}
          className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <div className="h-28 w-full bg-gradient-to-b from-primary/25 to-primary/5" />
          <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full border-4 border-card bg-primary p-1.5 text-primary-foreground">
            <Plus className="size-5" />
          </div>
          <div className="absolute bottom-2 w-full text-center text-xs font-semibold">Create story</div>
          <div className="absolute left-2 top-2">
            <Avatar src={me.profilePicture} name={me.firstName} initials={initials(me)} size={32} />
          </div>
        </button>

        {/* story groups */}
        {groups.map((g, i) => {
          const first = g.stories[0];
          const isOwn = g.author.id === me.id;
          return (
            <button
              key={g.author.id}
              onClick={() => setViewerStart(i)}
              className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary text-left shadow-sm transition-transform hover:-translate-y-0.5"
              style={
                first?.mediaUrl
                  ? { backgroundImage: `url(${first.mediaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: first?.backgroundColor ?? '#1877F2' }
              }
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className={cn('absolute left-2 top-2 rounded-full ring-4', g.hasUnseen ? 'ring-primary' : 'ring-white/40')}>
                <Avatar src={g.author.profilePicture} name={g.author.firstName} initials={initials(g.author)} size={32} />
              </div>
              <div className="absolute bottom-2 left-2 right-2 truncate text-xs font-semibold text-white drop-shadow">
                {isOwn ? 'Your story' : g.author.firstName}
              </div>
            </button>
          );
        })}
      </div>

      {creating && <CreateStoryDialog onClose={() => setCreating(false)} />}
      {viewerStart !== null && groups.length > 0 && (
        <StoryViewer groups={groups} startGroup={viewerStart} onClose={() => setViewerStart(null)} />
      )}
    </>
  );
}
