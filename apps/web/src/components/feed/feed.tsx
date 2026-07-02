'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useFeed } from '@/hooks/use-posts';
import { Composer } from './composer';
import { PostCard } from './post-card';

export function Feed() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed();
  const sentinel = React.useRef<HTMLDivElement>(null);

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  React.useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <Composer />

      {isLoading && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}

      {isError && (
        <p className="animate-fade-in rounded-xl bg-destructive/10 p-4 text-center text-sm text-destructive">
          Couldn&apos;t load the feed. Is the API running?
        </p>
      )}

      {!isLoading && posts.length === 0 && (
        <p className="animate-fade-in rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No posts yet — be the first to share something! ✍️
        </p>
      )}

      {posts.map((post, i) => (
        <div
          key={post.id}
          className="animate-fade-up"
          style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
        >
          <PostCard post={post} />
        </div>
      ))}

      <div ref={sentinel} />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="skeleton size-10 rounded-full" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-2.5 w-20" />
        </div>
      </div>
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-4/5" />
      <div className="skeleton h-44 w-full" />
    </div>
  );
}
