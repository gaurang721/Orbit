'use client';

import { Clock, Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { PostCard } from '@/components/feed/post-card';
import { useScheduledPosts } from '@/hooks/use-posts';

export default function ScheduledPage() {
  return (
    <SectionShell title="Scheduled posts" max="max-w-2xl">
      <ScheduledList />
    </SectionShell>
  );
}

function ScheduledList() {
  const { data, isLoading } = useScheduledPosts();
  const posts = data?.posts ?? [];

  if (isLoading) return <Loader2 className="mx-auto size-6 animate-spin text-primary" />;

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Clock className="mx-auto mb-2 size-8 text-rose-500" />
        <p>No scheduled posts. Use the clock icon in the composer to schedule one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">These will publish automatically at their scheduled time.</p>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
