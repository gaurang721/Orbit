'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useVideos } from '@/hooks/use-misc';
import { PostCard } from '@/components/feed/post-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { VideoPlayer } from '@/components/ui/video-player';
import { timeAgo } from '@/lib/utils';

/**
 * Static featured videos shown when there are no real video posts yet, so the
 * Watch tab always has something to play. Real videos (from /posts/videos)
 * still take precedence and replace these as soon as any exist.
 */
const STATIC_VIDEOS = [
  {
    id: 'static-bunny',
    title: 'Big Buck Bunny',
    author: 'Blender Foundation',
    initials: 'BF',
    createdAt: '2026-06-22T09:30:00.000Z',
    src: '/videos/bigbuckbunny.mp4',
  },
  {
    id: 'static-flower',
    title: 'Flower',
    author: 'Sample Videos',
    initials: 'SV',
    createdAt: '2026-06-21T14:10:00.000Z',
    src: '/videos/flower.mp4',
  },
  {
    id: 'static-sample',
    title: 'Sample Clip',
    author: 'Sample Videos',
    initials: 'SV',
    createdAt: '2026-06-20T18:45:00.000Z',
    src: '/videos/sample-5s.mp4',
  },
];

function StaticVideoCard({ video }: { video: (typeof STATIC_VIDEOS)[number] }) {
  return (
    <Card className="card-hover overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-2">
        <Avatar src={null} name={video.author} initials={video.initials} />
        <div>
          <div className="font-semibold">{video.author}</div>
          <div className="text-xs text-muted-foreground">{timeAgo(video.createdAt)}</div>
        </div>
      </div>
      <p className="px-4 pb-2 text-[15px] font-medium">{video.title}</p>
      <VideoPlayer src={video.src} className="max-h-[520px]" />
    </Card>
  );
}

export default function WatchPage() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useVideos();
  const videos = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <SectionShell title="Watch" max="max-w-xl">
      {isLoading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>}

      {/* No real videos yet → fall back to static featured videos. */}
      {!isLoading && videos.length === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Featured videos</p>
          {STATIC_VIDEOS.map((video, i) => (
            <div key={video.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <StaticVideoCard video={video} />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {videos.map((post, i) => (
          <div key={post.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
            <PostCard post={post} />
          </div>
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </SectionShell>
  );
}
