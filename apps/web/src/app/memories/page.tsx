'use client';

import { Clock, Loader2 } from 'lucide-react';
import { SectionShell } from '@/components/layout/section-shell';
import { useAuthStore } from '@/stores/auth-store';
import { useUserPosts } from '@/hooks/use-profile';
import { PostCard } from '@/components/feed/post-card';
import { Card } from '@/components/ui/card';

function MemoriesContent() {
  const me = useAuthStore((s) => s.user)!;
  const { data, isLoading } = useUserPosts(me.username);
  const posts = data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <Card className="flex items-center gap-3 bg-gradient-to-r from-primary/15 to-transparent p-4">
        <Clock className="size-6 text-primary" />
        <p className="text-sm">Look back on the things you&apos;ve shared on Orbit.</p>
      </Card>
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>}
      {!isLoading && posts.length === 0 && <p className="text-muted-foreground">You haven&apos;t posted anything yet.</p>}
      <div className="space-y-4">
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </>
  );
}

export default function MemoriesPage() {
  return (
    <SectionShell title="Memories" max="max-w-xl">
      <MemoriesContent />
    </SectionShell>
  );
}
