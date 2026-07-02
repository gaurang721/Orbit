'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Hash, Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { PostCard } from '@/components/feed/post-card';
import { Button } from '@/components/ui/button';
import { useHashtagFeed } from '@/hooks/use-posts';

export default function HashtagRoute() {
  const params = useParams();
  const tag = String(params?.tag ?? '').toLowerCase();
  return (
    <SectionShell max="max-w-2xl">
      <HashtagFeed tag={tag} />
    </SectionShell>
  );
}

function HashtagFeed({ tag }: { tag: string }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useHashtagFeed(tag);
  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hash className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">#{tag}</h1>
          {!isLoading && <p className="text-sm text-muted-foreground">{posts.length === 0 ? 'No posts yet' : 'Posts tagged with this hashtag'}</p>}
        </div>
      </div>

      {isLoading && <Loader2 className="mx-auto size-6 animate-spin text-primary" />}

      {!isLoading && posts.length === 0 && (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Nothing tagged <span className="font-semibold text-foreground">#{tag}</span> yet. Be the first — add it to a post! ✍️
        </p>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  );
}
